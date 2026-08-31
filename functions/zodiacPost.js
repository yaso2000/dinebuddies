const functions = require('firebase-functions');

/**
 * "Guess my sign?" (خمّن برجي) — an async story-rail game. The owner posts a card
 * with 3 personality traits + their REAL zodiac sign (kept server-only). The crowd
 * guesses the sign; after guessing they see the truth + how the crowd split.
 *
 * CREDIBILITY: the truth (the real sign) is stored in a separate `zodiac_truth/{id}`
 * doc clients can NEVER read (rules deny it); voters learn it only through the vote
 * callable's response, after voting. Posts auto-delete after 24h (purgeExpiredZodiac).
 */
const POST_TTL_MS = 24 * 60 * 60 * 1000;
const VALID_SIGNS = new Set([
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

function registerZodiacPost(exports, { db, admin, enforceCallableRateLimit }) {
    const FieldValue = admin.firestore.FieldValue;
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    async function loadUser(uid) {
        const s = await db.collection('users').doc(uid).get();
        const d = s.data() || {};
        return { data: d, name: d.displayName || d.display_name || 'User', avatar: d.photoURL || d.avatarUrl || '' };
    }

    // Traits are short {ar,en} hint words (the sign's own traits, chosen client-side).
    // They don't affect scoring (only the sign does), so we just sanitize shape/length.
    function normalizeTraits(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];
        for (const item of raw) {
            const ar = asTrimmed(item?.ar).slice(0, 40);
            const en = asTrimmed(item?.en).slice(0, 40);
            if (ar && en) out.push({ ar, en });
            if (out.length >= 3) break;
        }
        return out;
    }

    const zeroTally = () => {
        const t = {};
        VALID_SIGNS.forEach((s) => { t[s] = 0; });
        return t;
    };

    // ---- Publish a card (owner) ----------------------------------------------
    exports.createZodiacPost = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'zodiac_create', { cooldownMs: 3000, perHour: 20, perDay: 60 });

        const sign = asTrimmed(data?.sign).toLowerCase();
        if (!VALID_SIGNS.has(sign)) throw new functions.https.HttpsError('invalid-argument', 'Pick your zodiac sign.');
        const traits = normalizeTraits(data?.traits);
        if (traits.length !== 3) throw new functions.https.HttpsError('invalid-argument', 'Pick exactly 3 traits.');

        const me = await loadUser(uid);

        // One active card per owner: return the existing live one instead of stacking.
        const existingId = asTrimmed(me.data.zodiacActivePostId);
        if (existingId) {
            const ex = await db.collection('zodiac_posts').doc(existingId).get();
            const now = Date.now();
            const exp = ex.exists ? (ex.data()?.expiresAt?.toMillis?.() ?? 0) : 0;
            if (ex.exists && ex.data()?.status === 'live' && exp > now) {
                return { postId: existingId, existing: true };
            }
        }

        const nowTs = FieldValue.serverTimestamp();
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + POST_TTL_MS);
        const ref = db.collection('zodiac_posts').doc();
        // Public doc: NO sign/truth here — clients read this.
        await ref.set({
            ownerId: uid, ownerName: me.name, ownerAvatar: me.avatar,
            traits, status: 'live',
            tally: zeroTally(), voteCount: 0,
            createdAt: nowTs, updatedAt: nowTs, expiresAt,
        });
        // Server-only truth (rules deny all client access).
        await db.collection('zodiac_truth').doc(ref.id).set({ sign, ownerId: uid, createdAt: nowTs });
        await db.collection('users').doc(uid).set({ zodiacActivePostId: ref.id }, { merge: true });
        return { postId: ref.id };
    });

    // ---- Vote a guess (a sign) — FINAL, returns the reveal -------------------
    exports.voteZodiac = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'zodiac_vote', { cooldownMs: 600, perMinute: 40 });
        const postId = asTrimmed(data?.postId);
        const guess = asTrimmed(data?.guess).toLowerCase();
        if (!VALID_SIGNS.has(guess)) throw new functions.https.HttpsError('invalid-argument', 'Guess a valid sign.');

        const ref = db.collection('zodiac_posts').doc(postId);
        const voteRef = ref.collection('votes').doc(uid);
        const result = await db.runTransaction(async (tx) => {
            const ps = await tx.get(ref);
            if (!ps.exists) throw new functions.https.HttpsError('not-found', 'Card not found.');
            const post = ps.data() || {};
            if (post.ownerId === uid) throw new functions.https.HttpsError('failed-precondition', 'You cannot guess your own sign.');
            if (post.status !== 'live' || (post.expiresAt?.toMillis?.() ?? 0) <= Date.now()) {
                throw new functions.https.HttpsError('failed-precondition', 'This round has ended.');
            }
            // A guess is FINAL — never changes (keeps the result credible).
            const vs = await tx.get(voteRef);
            if (vs.exists) return { changed: false, guess: String(vs.data()?.guess || '') };
            const inc = {};
            inc[`tally.${guess}`] = FieldValue.increment(1);
            inc.voteCount = FieldValue.increment(1);
            inc.updatedAt = FieldValue.serverTimestamp();
            tx.set(voteRef, { uid, guess, at: FieldValue.serverTimestamp() });
            tx.update(ref, inc);
            return { changed: true, guess };
        });

        // Reveal the truth (server-only truth doc) + fresh tally.
        const [truthSnap, freshSnap] = await Promise.all([
            db.collection('zodiac_truth').doc(postId).get(),
            ref.get(),
        ]);
        const truth = truthSnap.exists ? String(truthSnap.data()?.sign || '') : '';
        const fresh = freshSnap.data() || {};
        return {
            ok: true,
            guess: result.guess,
            truth,
            correct: result.guess === truth,
            tally: fresh.tally || zeroTally(),
            voteCount: fresh.voteCount || 0,
        };
    });

    // ---- End early (owner) ----------------------------------------------------
    exports.endZodiacPost = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const postId = asTrimmed(data?.postId);
        const ref = db.collection('zodiac_posts').doc(postId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Card not found.');
        if (s.data()?.ownerId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the owner can end this.');
        await ref.update({ status: 'ended', updatedAt: FieldValue.serverTimestamp() });
        try {
            const uref = db.collection('users').doc(uid);
            const us = await uref.get();
            if (us.exists && us.data()?.zodiacActivePostId === postId) await uref.update({ zodiacActivePostId: null });
        } catch (err) { console.warn('[zodiac] clear pointer', err?.message || err); }
        return { ok: true };
    });

    // ---- List voters (owner only) — powers the "connect with them" sheet -----
    exports.listZodiacVoters = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const postId = asTrimmed(data?.postId);
        const ref = db.collection('zodiac_posts').doc(postId);
        const ps = await ref.get();
        if (!ps.exists) throw new functions.https.HttpsError('not-found', 'Card not found.');
        if (ps.data()?.ownerId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the owner can see voters.');
        const votesSnap = await ref.collection('votes').orderBy('at', 'desc').limit(100).get();
        const voterIds = votesSnap.docs.map((d) => d.id).filter((id) => id && id !== uid);
        const voters = [];
        for (const vid of voterIds) {
            try {
                const u = await loadUser(vid);
                voters.push({ uid: vid, name: u.name, avatar: u.avatar });
            } catch { /* skip */ }
        }
        return { voters };
    });

    // ---- Scheduled purge: delete expired cards + truth -----------------------
    exports.purgeExpiredZodiac = functions
        .runWith({ timeoutSeconds: 300, memory: '512MB' })
        .pubsub.schedule('every 1 hours')
        .onRun(async () => {
            const now = admin.firestore.Timestamp.now();
            let snap;
            try {
                snap = await db.collection('zodiac_posts').where('expiresAt', '<=', now).limit(80).get();
            } catch (err) { console.warn('[zodiac] purge query', err?.message || err); return null; }
            for (const doc of snap.docs) {
                const d = doc.data() || {};
                try {
                    if (typeof db.recursiveDelete === 'function') await db.recursiveDelete(doc.ref);
                    else await doc.ref.delete();
                } catch (err) { console.warn('[zodiac] doc delete', err?.message || err); }
                try { await db.collection('zodiac_truth').doc(doc.id).delete(); } catch { /* ignore */ }
                try {
                    const uref = db.collection('users').doc(d.ownerId);
                    const us = await uref.get();
                    if (us.exists && us.data()?.zodiacActivePostId === doc.id) await uref.update({ zodiacActivePostId: null });
                } catch { /* ignore */ }
            }
            console.info('[zodiac] purged', snap.size);
            return null;
        });
}

module.exports = { registerZodiacPost };
