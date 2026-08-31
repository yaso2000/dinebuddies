const functions = require('firebase-functions');

/**
 * "Real or AI?" — a guessing game. The owner posts an image that is EITHER a live
 * camera photo (real) OR an in-app AI generation (paid). The crowd guesses real/ai;
 * after guessing they see the truth + how many guessed right.
 *
 * CREDIBILITY: the truth is NEVER trusted from the client. The server DERIVES the
 * source from the image's storage PATH — AI images live under `realornai/{uid}/…`
 * (written server-side by the paid AI pipeline) and camera photos under
 * `realornai-photos/{uid}/…` (written by the moderated-upload callable). The truth is
 * stored in a separate `realornai_truth/{id}` doc that clients can NEVER read (rules
 * deny it); voters learn it only through the vote callable's response, after voting.
 *
 * Images auto-delete after 24h (see purgeExpiredRealOrAi) — nothing is kept.
 */
const POST_TTL_MS = 24 * 60 * 60 * 1000;
const AI_PATH_PREFIX = 'realornai/';
const CAMERA_PATH_PREFIX = 'realornai-photos/';

function registerRealOrAiPost(exports, { db, admin, enforceCallableRateLimit }) {
    const FieldValue = admin.firestore.FieldValue;
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    async function loadUser(uid) {
        const s = await db.collection('users').doc(uid).get();
        const d = s.data() || {};
        return { data: d, name: d.displayName || d.display_name || 'User', avatar: d.photoURL || d.avatarUrl || '' };
    }

    /** Derive the TRUE source from the storage path — never trust the client. */
    function deriveSource(imagePath, uid) {
        const p = asTrimmed(imagePath);
        if (!p || !p.includes(`/${uid}/`)) return null; // must be owned by the caller
        if (p.startsWith(AI_PATH_PREFIX)) return 'ai';
        if (p.startsWith(CAMERA_PATH_PREFIX)) return 'camera';
        return null;
    }

    // ---- Publish a post (owner) ----------------------------------------------
    exports.createRealOrAiPost = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'realornai_create', { cooldownMs: 3000, perHour: 20, perDay: 60 });

        const imageUrl = asTrimmed(data?.imageUrl);
        const imagePath = asTrimmed(data?.imagePath);
        if (!imageUrl || !/^https:\/\//i.test(imageUrl)) throw new functions.https.HttpsError('invalid-argument', 'Missing image.');
        const source = deriveSource(imagePath, uid);
        if (!source) throw new functions.https.HttpsError('invalid-argument', 'Image not recognized. Use the camera or AI generator in the game.');

        const me = await loadUser(uid);

        // One active post per owner: return the existing live one instead of stacking.
        const existingId = asTrimmed(me.data.realOrAiActivePostId);
        if (existingId) {
            const ex = await db.collection('realornai_posts').doc(existingId).get();
            const now = Date.now();
            const exp = ex.exists ? (ex.data()?.expiresAt?.toMillis?.() ?? 0) : 0;
            if (ex.exists && ex.data()?.status === 'live' && exp > now) {
                return { postId: existingId, existing: true };
            }
        }

        const nowTs = FieldValue.serverTimestamp();
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + POST_TTL_MS);
        const ref = db.collection('realornai_posts').doc();
        // Public doc: NO source/truth here — clients read this.
        await ref.set({
            ownerId: uid, ownerName: me.name, ownerAvatar: me.avatar,
            imageUrl, imagePath, status: 'live',
            tally: { real: 0, ai: 0 }, voteCount: 0,
            createdAt: nowTs, updatedAt: nowTs, expiresAt,
        });
        // Server-only truth (rules deny all client access).
        await db.collection('realornai_truth').doc(ref.id).set({ source, ownerId: uid, createdAt: nowTs });
        await db.collection('users').doc(uid).set({ realOrAiActivePostId: ref.id }, { merge: true });
        return { postId: ref.id };
    });

    // ---- Vote a guess (real/ai) — FINAL, returns the reveal ------------------
    exports.voteRealOrAi = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'realornai_vote', { cooldownMs: 600, perMinute: 40 });
        const postId = asTrimmed(data?.postId);
        const guess = asTrimmed(data?.guess).toLowerCase();
        if (guess !== 'real' && guess !== 'ai') throw new functions.https.HttpsError('invalid-argument', 'Guess real or ai.');

        const ref = db.collection('realornai_posts').doc(postId);
        const voteRef = ref.collection('votes').doc(uid);
        const result = await db.runTransaction(async (tx) => {
            const ps = await tx.get(ref);
            if (!ps.exists) throw new functions.https.HttpsError('not-found', 'Post not found.');
            const post = ps.data() || {};
            if (post.ownerId === uid) throw new functions.https.HttpsError('failed-precondition', 'You cannot guess on your own card.');
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
            db.collection('realornai_truth').doc(postId).get(),
            ref.get(),
        ]);
        const source = truthSnap.exists ? String(truthSnap.data()?.source || '') : '';
        const truth = source === 'ai' ? 'ai' : 'real'; // camera → real
        const fresh = freshSnap.data() || {};
        return {
            ok: true,
            guess: result.guess,
            truth,
            correct: result.guess === truth,
            tally: fresh.tally || { real: 0, ai: 0 },
            voteCount: fresh.voteCount || 0,
        };
    });

    // ---- End early (owner) ----------------------------------------------------
    exports.endRealOrAiPost = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const postId = asTrimmed(data?.postId);
        const ref = db.collection('realornai_posts').doc(postId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Post not found.');
        if (s.data()?.ownerId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the owner can end this.');
        await ref.update({ status: 'ended', updatedAt: FieldValue.serverTimestamp() });
        try {
            const uref = db.collection('users').doc(uid);
            const us = await uref.get();
            if (us.exists && us.data()?.realOrAiActivePostId === postId) await uref.update({ realOrAiActivePostId: null });
        } catch (err) { console.warn('[realOrAi] clear pointer', err?.message || err); }
        return { ok: true };
    });

    // ---- List voters (owner only) — powers the "connect with them" sheet -----
    exports.listRealOrAiVoters = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const postId = asTrimmed(data?.postId);
        const ref = db.collection('realornai_posts').doc(postId);
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

    // ---- Scheduled purge: delete expired posts + their Storage images --------
    exports.purgeExpiredRealOrAi = functions
        .runWith({ timeoutSeconds: 300, memory: '512MB' })
        .pubsub.schedule('every 1 hours')
        .onRun(async () => {
            const now = admin.firestore.Timestamp.now();
            let snap;
            try {
                snap = await db.collection('realornai_posts').where('expiresAt', '<=', now).limit(80).get();
            } catch (err) { console.warn('[realOrAi] purge query', err?.message || err); return null; }
            const bucket = admin.storage().bucket();
            for (const doc of snap.docs) {
                const d = doc.data() || {};
                // Delete the stored image (best effort).
                if (d.imagePath) {
                    try { await bucket.file(d.imagePath).delete(); } catch (err) { if (err?.code !== 404) console.warn('[realOrAi] img delete', err?.message || err); }
                }
                // Delete votes subcollection, truth doc, the post, and clear the owner pointer.
                try {
                    if (typeof db.recursiveDelete === 'function') await db.recursiveDelete(doc.ref);
                    else await doc.ref.delete();
                } catch (err) { console.warn('[realOrAi] doc delete', err?.message || err); }
                try { await db.collection('realornai_truth').doc(doc.id).delete(); } catch { /* ignore */ }
                try {
                    const uref = db.collection('users').doc(d.ownerId);
                    const us = await uref.get();
                    if (us.exists && us.data()?.realOrAiActivePostId === doc.id) await uref.update({ realOrAiActivePostId: null });
                } catch { /* ignore */ }
            }
            console.info('[realOrAi] purged', snap.size);
            return null;
        });
}

module.exports = { registerRealOrAiPost };
