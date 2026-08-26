const functions = require('firebase-functions');
const { GoogleAuth } = require('google-auth-library');

/**
 * "Match or Not" — a live, consent-first matchmaking show. The host opens a
 * broadcast with two photo slots (each with a gender requirement). Users APPLY
 * to appear (opt-in — nobody is featured without volunteering). The host picks
 * two applicants from the queue; they go on stage; everyone else votes
 * ✅ match / ❌ not. The host reveals the tally, then brings up the next pair.
 *
 * Peek-proof votes (owner-only); the server tallies at reveal. A later phase adds
 * the "connect" hook (both featured users accept -> a real connection).
 */
const GENDERS = ['male', 'female', 'any'];
const REL_GOALS = ['marriage', 'longterm', 'shortterm', 'undecided'];
const MAX_INTRO_WORDS = 40;   // written intro word cap

function registerMatchShow(exports, { db, admin, enforceCallableRateLimit }) {
    const FieldValue = admin.firestore.FieldValue;
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');
    const genderOf = (d) => {
        const g = String(d?.gender || '').toLowerCase();
        return g === 'male' || g === 'female' ? g : 'unknown';
    };

    const genCode = () => {
        const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let s = '';
        for (let i = 0; i < 5; i += 1) s += a[Math.floor(Math.random() * a.length)];
        return s;
    };
    const randomId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

    async function loadUser(uid) {
        const s = await db.collection('users').doc(uid).get();
        const d = s.data() || {};
        return {
            data: d,
            name: d.displayName || d.display_name || 'User',
            avatar: d.photoURL || d.avatarUrl || '',
            gender: genderOf(d),
        };
    }

    const isMutualFollow = (aF, bF, a, b) => Array.isArray(aF) && Array.isArray(bF) && aF.includes(b) && bF.includes(a);

    async function requireShow(showId) {
        const ref = db.collection('match_shows').doc(showId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Show not found.');
        return { ref, show: s.data() || {} };
    }
    const assertHost = (show, uid) => {
        if (show.hostId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the host can do that.');
    };
    async function clearHostPointer(hostId, showId) {
        try {
            const uref = db.collection('users').doc(hostId);
            const s = await uref.get();
            if (s.exists && s.data()?.hostActiveShowId === showId) await uref.update({ hostActiveShowId: FieldValue.delete() });
        } catch (err) { console.warn('[matchShow] clear pointer', err?.message || err); }
    }

    // ---- Create (host) --------------------------------------------------------
    exports.createMatchShow = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'match_show_create', { cooldownMs: 3000, perHour: 20, perDay: 60 });

        const rawSlots = Array.isArray(data?.slotGenders) ? data.slotGenders : [];
        const slotGenders = [0, 1].map((i) => (GENDERS.includes(String(rawSlots[i]).toLowerCase()) ? String(rawSlots[i]).toLowerCase() : 'any'));
        const visibility = asTrimmed(data?.visibility).toLowerCase() === 'invite_only' ? 'invite_only' : 'public';

        const me = await loadUser(uid);
        // One live show per host.
        const existingId = asTrimmed(me.data.hostActiveShowId);
        if (existingId) {
            const ex = await db.collection('match_shows').doc(existingId).get();
            if (ex.exists && ex.data()?.status !== 'ended') return { showId: existingId, joinCode: ex.data().joinCode, existing: true };
        }

        // Invitees (mutual follows), like the group games / stages.
        const candidates = [...new Set((Array.isArray(data?.inviteeIds) ? data.inviteeIds : []).map((id) => asTrimmed(id)).filter((id) => id && id !== uid))].slice(0, 30);
        const hostFollowing = Array.isArray(me.data.following) ? me.data.following : [];
        const invitedIds = [];
        for (const inv of candidates) {
            const s = await db.collection('users').doc(inv).get();
            if (!s.exists) continue;
            const u = s.data() || {};
            if (String(u.role || '').toLowerCase() === 'guest' || u.isGuest === true) continue;
            if (!isMutualFollow(hostFollowing, u.following, uid, inv)) continue;
            invitedIds.push(inv);
        }
        if (visibility === 'invite_only' && invitedIds.length === 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Invite at least one person for a private show.');
        }

        const now = FieldValue.serverTimestamp();
        const ref = db.collection('match_shows').doc();
        await ref.set({
            hostId: uid,
            hostName: me.name,
            hostAvatar: me.avatar,
            status: 'live', // live | ended
            slotGenders,
            visibility,
            open: visibility === 'public',
            invitedIds,
            joinCode: genCode(),
            currentPair: null,
            pairStatus: 'idle', // idle | voting | revealed
            reveal: null,
            applicantCount: 0,
            createdAt: now,
            updatedAt: now,
        });
        await db.collection('users').doc(uid).set({ hostActiveShowId: ref.id }, { merge: true });
        return { showId: ref.id, joinCode: (await ref.get()).data().joinCode };
    });

    // ---- Apply to appear (any viewer, opt-in) --------------------------------
    exports.applyToMatchShow = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'match_show_apply', { cooldownMs: 1500, perMinute: 10 });
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        if (show.status !== 'live') throw new functions.https.HttpsError('failed-precondition', 'This show has ended.');
        if (show.hostId === uid) throw new functions.https.HttpsError('failed-precondition', 'The host cannot be a candidate.');

        const me = await loadUser(uid);
        if (me.gender !== 'male' && me.gender !== 'female') {
            throw new functions.https.HttpsError('failed-precondition', 'Set your gender in your profile to join.');
        }
        // Must be eligible for at least one slot.
        const fits = (show.slotGenders || []).some((g) => g === 'any' || g === me.gender);
        if (!fits) throw new functions.https.HttpsError('failed-precondition', 'This show is not open to your slot.');
        if (!me.avatar) throw new functions.https.HttpsError('failed-precondition', 'Add a profile photo to appear.');

        // A short mini-profile is required with every application (mandatory
        // fields) so voters judge the person, not just the photo.
        const age = Math.round(Number(data?.age) || 0);
        if (age < 18 || age > 99) throw new functions.https.HttpsError('invalid-argument', 'Enter a valid age (18+).');
        const lookingFor = asTrimmed(data?.lookingFor).slice(0, 160);
        if (!lookingFor) throw new functions.https.HttpsError('invalid-argument', 'Add what you are looking for.');
        const about = asTrimmed(data?.about).slice(0, 400);
        if (!about) throw new functions.https.HttpsError('invalid-argument', 'Write a short intro (or use AI to help).');
        if (about.split(/\s+/).filter(Boolean).length > MAX_INTRO_WORDS) {
            throw new functions.https.HttpsError('invalid-argument', `Keep the intro under ${MAX_INTRO_WORDS} words.`);
        }
        const goal = asTrimmed(data?.goal).toLowerCase();
        if (!REL_GOALS.includes(goal)) throw new functions.https.HttpsError('invalid-argument', 'Choose a relationship type.');
        const interests = (Array.isArray(data?.interests) ? data.interests : []).map((x) => asTrimmed(x).slice(0, 24)).filter(Boolean).slice(0, 3);
        const profile = { age, goal, interests, lookingFor, about };

        const appRef = ref.collection('applicants').doc(uid);
        const existing = await appRef.get();
        const now = FieldValue.serverTimestamp();
        await appRef.set({ uid, name: me.name, avatar: me.avatar, gender: me.gender, profile, status: 'queued', appliedAt: now }, { merge: true });
        if (!existing.exists) await ref.update({ applicantCount: FieldValue.increment(1), updatedAt: now });
        return { ok: true };
    });

    exports.withdrawMatchApplication = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref } = await requireShow(asTrimmed(data?.showId));
        const appRef = ref.collection('applicants').doc(uid);
        const s = await appRef.get();
        if (s.exists && s.data()?.status === 'queued') {
            await appRef.delete();
            await ref.update({ applicantCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
        }
        return { ok: true };
    });

    // ---- AI helps write the intro ("about") ----------------------------------
    exports.generateMatchIntro = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'match_intro_ai', { cooldownMs: 3000, perHour: 40 });
        const me = await loadUser(uid);
        const age = Math.round(Number(data?.age) || 0) || '';
        const goal = asTrimmed(data?.goal);
        const interests = (Array.isArray(data?.interests) ? data.interests : []).map((x) => asTrimmed(x)).filter(Boolean).slice(0, 3);
        const lookingFor = asTrimmed(data?.lookingFor).slice(0, 160);
        const locale = asTrimmed(data?.locale).slice(0, 5) || 'ar';

        const prompt = [
            'Write a warm, genuine first-person self-introduction for a light-hearted matchmaking game — 1 to 2 short sentences, under 35 words.',
            `Language: ${locale}. Friendly, respectful, a little charming; no clichés, no emojis, no quotes.`,
            me.name ? `Name: ${me.name}.` : '',
            age ? `Age: ${age}.` : '',
            goal ? `Looking for: ${goal} relationship.` : '',
            interests.length ? `Interests: ${interests.join(', ')}.` : '',
            lookingFor ? `Wants in a partner: ${lookingFor}.` : '',
            'Return ONLY the intro text, nothing else.',
        ].filter(Boolean).join('\n');

        try {
            const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
            const client = await auth.getClient();
            const project = process.env.GCLOUD_PROJECT?.trim() || 'dinebuddies';
            const loc = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';
            const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
            const url = `https://${loc}-aiplatform.googleapis.com/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`;
            const res = await client.request({ url, method: 'POST', data: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 120 } } });
            const text = String(res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^["“]|["”]$/g, '');
            if (!text) throw new Error('empty');
            return { about: text.slice(0, 300) };
        } catch (err) {
            console.error('[matchShow] intro AI', err?.message || err);
            throw new functions.https.HttpsError('internal', 'Could not generate — please write your own.');
        }
    });

    // ---- Select a pair (host) -------------------------------------------------
    exports.selectMatchPair = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        if (show.status !== 'live') throw new functions.https.HttpsError('failed-precondition', 'Show ended.');
        const uidA = asTrimmed(data?.uidA);
        const uidB = asTrimmed(data?.uidB);
        if (!uidA || !uidB || uidA === uidB) throw new functions.https.HttpsError('invalid-argument', 'Pick two different applicants.');

        const [sa, sb] = await Promise.all([ref.collection('applicants').doc(uidA).get(), ref.collection('applicants').doc(uidB).get()]);
        if (!sa.exists || !sb.exists) throw new functions.https.HttpsError('not-found', 'Applicant not found.');
        const A = sa.data() || {}; const B = sb.data() || {};

        // Fit to the two slots (try A->0,B->1 then swap).
        const [g0, g1] = show.slotGenders || ['any', 'any'];
        const okOrder = (x, y) => (g0 === 'any' || x.gender === g0) && (g1 === 'any' || y.gender === g1);
        let a = A; let b = B;
        if (!okOrder(A, B)) {
            if (okOrder(B, A)) { a = B; b = A; } else {
                throw new functions.https.HttpsError('failed-precondition', 'Their genders do not fit the two slots.');
            }
        }
        const pairId = randomId();
        const now = FieldValue.serverTimestamp();
        await ref.update({
            currentPair: {
                pairId,
                a: { uid: a.uid, name: a.name, avatar: a.avatar, gender: a.gender, profile: a.profile || null },
                b: { uid: b.uid, name: b.name, avatar: b.avatar, gender: b.gender, profile: b.profile || null },
            },
            pairStatus: 'voting',
            reveal: null,
            updatedAt: now,
        });
        await ref.collection('applicants').doc(a.uid).update({ status: 'onstage' });
        await ref.collection('applicants').doc(b.uid).update({ status: 'onstage' });
        return { ok: true, pairId };
    });

    // ---- Vote (viewers, not the two on stage) --------------------------------
    exports.voteMatch = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        if (show.status !== 'live' || show.pairStatus !== 'voting' || !show.currentPair) {
            throw new functions.https.HttpsError('failed-precondition', 'Voting is not open.');
        }
        const pair = show.currentPair;
        if (uid === pair.a.uid || uid === pair.b.uid) throw new functions.https.HttpsError('failed-precondition', 'You are on stage — you cannot vote.');
        const vote = asTrimmed(data?.vote).toLowerCase();
        if (vote !== 'match' && vote !== 'no') throw new functions.https.HttpsError('invalid-argument', 'Invalid vote.');

        await ref.collection('votes').doc(`${pair.pairId}_${uid}`).set({ pairId: pair.pairId, uid, vote, at: FieldValue.serverTimestamp() });
        return { ok: true };
    });

    // ---- Reveal the current pair (host) --------------------------------------
    exports.revealMatch = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        if (show.pairStatus !== 'voting' || !show.currentPair) throw new functions.https.HttpsError('failed-precondition', 'No pair is being voted on.');

        const pairId = show.currentPair.pairId;
        const vs = await ref.collection('votes').where('pairId', '==', pairId).get();
        let yes = 0; let no = 0;
        vs.forEach((d) => { const v = d.data()?.vote; if (v === 'match') yes += 1; else if (v === 'no') no += 1; });
        const total = yes + no;
        const pct = total ? Math.round((100 * yes) / total) : 0;
        await ref.update({ pairStatus: 'revealed', reveal: { yes, no, total, pct, isMatch: yes > no }, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, yes, no, pct };
    });

    // ---- Next pair (host): clear stage, back to selecting ---------------------
    exports.nextMatchPair = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        const pair = show.currentPair;
        if (pair) {
            await Promise.all([
                ref.collection('applicants').doc(pair.a.uid).set({ status: 'done' }, { merge: true }),
                ref.collection('applicants').doc(pair.b.uid).set({ status: 'done' }, { merge: true }),
            ]);
        }
        await ref.update({ currentPair: null, pairStatus: 'idle', reveal: null, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true };
    });

    // ---- End the show (host) --------------------------------------------------
    exports.endMatchShow = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        await ref.update({ status: 'ended', currentPair: null, pairStatus: 'idle', updatedAt: FieldValue.serverTimestamp() });
        await clearHostPointer(uid, ref.id);
        return { ok: true };
    });
}

module.exports = { registerMatchShow };
