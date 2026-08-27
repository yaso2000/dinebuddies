const functions = require('firebase-functions');
const { GoogleAuth } = require('google-auth-library');

/**
 * "Match or Not" — a live, consent-first matchmaking show. The BROADCASTER is one
 * side: they fill a short mini-profile and set the gender they're looking for.
 * Other users APPLY (opt-in) to be their match, each with a mini-profile. The
 * host brings applicants up ONE at a time beside themselves; the room votes
 * ✅ match / ❌ not; the host reveals the tally, then brings up the next applicant.
 *
 * Peek-proof votes (owner-only); the server tallies at reveal.
 */
const GENDERS = ['male', 'female', 'any'];
const REL_GOALS = ['marriage', 'longterm', 'shortterm', 'undecided'];
const MAX_INTRO_WORDS = 40;

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
        return { data: d, name: d.displayName || d.display_name || 'User', avatar: d.photoURL || d.avatarUrl || '', gender: genderOf(d) };
    }
    const isMutualFollow = (aF, bF, a, b) => Array.isArray(aF) && Array.isArray(bF) && aF.includes(b) && bF.includes(a);

    /** Validate + normalize a mini-profile from the request (host or applicant). */
    function readProfile(data) {
        const age = Math.round(Number(data?.age) || 0);
        if (age < 18 || age > 99) throw new functions.https.HttpsError('invalid-argument', 'Enter a valid age (18+).');
        const goal = asTrimmed(data?.goal).toLowerCase();
        if (!REL_GOALS.includes(goal)) throw new functions.https.HttpsError('invalid-argument', 'Choose a relationship type.');
        const lookingFor = asTrimmed(data?.lookingFor).slice(0, 160);
        if (!lookingFor) throw new functions.https.HttpsError('invalid-argument', 'Add what you are looking for.');
        const about = asTrimmed(data?.about).slice(0, 400);
        if (!about) throw new functions.https.HttpsError('invalid-argument', 'Write a short intro (or use AI to help).');
        if (about.split(/\s+/).filter(Boolean).length > MAX_INTRO_WORDS) {
            throw new functions.https.HttpsError('invalid-argument', `Keep the intro under ${MAX_INTRO_WORDS} words.`);
        }
        const interests = (Array.isArray(data?.interests) ? data.interests : []).map((x) => asTrimmed(x).slice(0, 24)).filter(Boolean).slice(0, 3);
        return { age, goal, interests, lookingFor, about };
    }

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
            if (s.exists && s.data()?.hostActiveShowId === showId) await uref.update({ hostActiveShowId: null });
        } catch (err) { console.warn('[matchShow] clear pointer', err?.message || err); }
    }

    // ---- Create (host is one side; fills their own mini-profile) --------------
    exports.createMatchShow = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'match_show_create', { cooldownMs: 3000, perHour: 20, perDay: 60 });

        const me = await loadUser(uid);
        if (me.gender !== 'male' && me.gender !== 'female') throw new functions.https.HttpsError('failed-precondition', 'Set your gender in your profile first.');
        if (!me.avatar) throw new functions.https.HttpsError('failed-precondition', 'Add a profile photo first.');
        const hostProfile = readProfile(data);
        const wantGender = GENDERS.includes(String(data?.wantGender).toLowerCase()) ? String(data.wantGender).toLowerCase() : 'any';
        const visibility = asTrimmed(data?.visibility).toLowerCase() === 'invite_only' ? 'invite_only' : 'public';

        const existingId = asTrimmed(me.data.hostActiveShowId);
        if (existingId) {
            const ex = await db.collection('match_shows').doc(existingId).get();
            if (ex.exists && ex.data()?.status !== 'ended') return { showId: existingId, joinCode: ex.data().joinCode, existing: true };
        }

        const hostFollowing = Array.isArray(me.data.following) ? me.data.following : [];
        const cands = [...new Set((Array.isArray(data?.inviteeIds) ? data.inviteeIds : []).map((id) => asTrimmed(id)).filter((id) => id && id !== uid))].slice(0, 30);
        const invitedIds = [];
        for (const inv of cands) {
            const s = await db.collection('users').doc(inv).get();
            if (!s.exists) continue;
            const u = s.data() || {};
            if (String(u.role || '').toLowerCase() === 'guest' || u.isGuest === true) continue;
            if (!isMutualFollow(hostFollowing, u.following, uid, inv)) continue;
            invitedIds.push(inv);
        }
        if (visibility === 'invite_only' && invitedIds.length === 0) throw new functions.https.HttpsError('failed-precondition', 'Invite at least one person for a private show.');

        const now = FieldValue.serverTimestamp();
        const ref = db.collection('match_shows').doc();
        await ref.set({
            hostId: uid, hostName: me.name, hostAvatar: me.avatar, hostGender: me.gender, hostProfile,
            wantGender, status: 'live', visibility, open: visibility === 'public', invitedIds,
            joinCode: genCode(), currentApplicant: null, pairStatus: 'idle', reveal: null, applicantCount: 0,
            createdAt: now, updatedAt: now,
        });
        await db.collection('users').doc(uid).set({ hostActiveShowId: ref.id }, { merge: true });
        return { showId: ref.id, joinCode: (await ref.get()).data().joinCode };
    });

    // ---- AI helps write the "about" ------------------------------------------
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
            me.name ? `Name: ${me.name}.` : '', age ? `Age: ${age}.` : '', goal ? `Looking for: ${goal} relationship.` : '',
            interests.length ? `Interests: ${interests.join(', ')}.` : '', lookingFor ? `Wants in a partner: ${lookingFor}.` : '',
            'Return ONLY the intro text.',
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

    // ---- Apply to be the host's match (opt-in) -------------------------------
    exports.applyToMatchShow = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'match_show_apply', { cooldownMs: 1500, perMinute: 10 });
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        if (show.status !== 'live') throw new functions.https.HttpsError('failed-precondition', 'This show has ended.');
        if (show.hostId === uid) throw new functions.https.HttpsError('failed-precondition', 'You are the host of this show.');

        const me = await loadUser(uid);
        if (me.gender !== 'male' && me.gender !== 'female') throw new functions.https.HttpsError('failed-precondition', 'Set your gender in your profile to join.');
        if (show.wantGender !== 'any' && me.gender !== show.wantGender) throw new functions.https.HttpsError('failed-precondition', 'This show is looking for someone else.');
        if (!me.avatar) throw new functions.https.HttpsError('failed-precondition', 'Add a profile photo to appear.');
        const profile = readProfile(data);

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

    // ---- Bring one applicant up beside the host (host) ------------------------
    exports.bringUpApplicant = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        if (show.status !== 'live') throw new functions.https.HttpsError('failed-precondition', 'Show ended.');
        const applicantUid = asTrimmed(data?.applicantUid);
        const sa = await ref.collection('applicants').doc(applicantUid).get();
        if (!sa.exists) throw new functions.https.HttpsError('not-found', 'Applicant not found.');
        const a = sa.data() || {};
        const pairId = randomId();
        const now = FieldValue.serverTimestamp();
        await ref.update({
            currentApplicant: { pairId, uid: a.uid, name: a.name, avatar: a.avatar, gender: a.gender, profile: a.profile || null },
            pairStatus: 'voting', reveal: null, updatedAt: now,
        });
        await ref.collection('applicants').doc(a.uid).update({ status: 'onstage' });
        return { ok: true, pairId };
    });

    // ---- Vote (viewers, not the host and not the current applicant) ----------
    exports.voteMatch = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        if (show.status !== 'live' || show.pairStatus !== 'voting' || !show.currentApplicant) throw new functions.https.HttpsError('failed-precondition', 'Voting is not open.');
        if (uid === show.hostId || uid === show.currentApplicant.uid) throw new functions.https.HttpsError('failed-precondition', 'You are on stage — you cannot vote.');
        const vote = asTrimmed(data?.vote).toLowerCase();
        if (vote !== 'match' && vote !== 'no') throw new functions.https.HttpsError('invalid-argument', 'Invalid vote.');
        await ref.collection('votes').doc(`${show.currentApplicant.pairId}_${uid}`).set({ pairId: show.currentApplicant.pairId, uid, vote, at: FieldValue.serverTimestamp() });
        return { ok: true };
    });

    // ---- Reveal (host) --------------------------------------------------------
    exports.revealMatch = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        if (show.pairStatus !== 'voting' || !show.currentApplicant) throw new functions.https.HttpsError('failed-precondition', 'No one is being voted on.');
        const pairId = show.currentApplicant.pairId;
        const vs = await ref.collection('votes').where('pairId', '==', pairId).get();
        let yes = 0; let no = 0;
        vs.forEach((d) => { const v = d.data()?.vote; if (v === 'match') yes += 1; else if (v === 'no') no += 1; });
        const total = yes + no;
        const pct = total ? Math.round((100 * yes) / total) : 0;
        await ref.update({ pairStatus: 'revealed', reveal: { yes, no, total, pct, isMatch: yes > no }, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, yes, no, pct };
    });

    // ---- Next applicant (host) ------------------------------------------------
    exports.nextApplicant = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        if (show.currentApplicant) await ref.collection('applicants').doc(show.currentApplicant.uid).set({ status: 'done' }, { merge: true });
        await ref.update({ currentApplicant: null, pairStatus: 'idle', reveal: null, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true };
    });

    // ---- End (host) -----------------------------------------------------------
    exports.endMatchShow = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, show } = await requireShow(asTrimmed(data?.showId));
        assertHost(show, uid);
        await ref.update({ status: 'ended', currentApplicant: null, pairStatus: 'idle', updatedAt: FieldValue.serverTimestamp() });
        await clearHostPointer(uid, ref.id);
        return { ok: true };
    });
}

module.exports = { registerMatchShow };
