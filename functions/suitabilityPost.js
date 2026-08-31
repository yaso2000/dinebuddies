const functions = require('firebase-functions');

/**
 * "Who suits you?" (مَن يناسبك؟) — an async, story-rail matchmaking poll.
 *
 * A person publishes a card (their real photo + nickname + a short intro). It
 * lives on the stories rail for 24 hours. Anyone who opens it votes which
 * PARTNER ARCHETYPE (a fixed set of warm personality types) would suit them
 * best. There is no host, no live stage, no hearts — just a friendly crowd
 * poll. The owner sees which type the crowd picked for them.
 *
 * The tally is kept on the post doc (incremented in a transaction) so results
 * are cheap to read. A vote can be changed; the transaction moves the count.
 */

// Keep in sync with src/constants/suitabilityArchetypes.js (ids only).
const ARCHETYPE_IDS = ['adventurer', 'warm', 'ambitious', 'playful', 'calm', 'intellectual', 'romantic', 'dependable'];
// Keep in sync with src/constants/personalityTraits.js (ids only).
const TRAIT_IDS = ['generous', 'romantic', 'funny', 'ambitious', 'kind', 'honest', 'cultured', 'calm', 'adventurous', 'confident', 'goodhearted', 'smart', 'wellmannered', 'social', 'patient', 'loyal'];
const TRAITS_REQUIRED = 3;
const POST_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ABOUT_WORDS = 40;

function registerSuitabilityPost(exports, { db, admin, enforceCallableRateLimit }) {
    const FieldValue = admin.firestore.FieldValue;
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');
    const genderOf = (d) => {
        const g = String(d?.gender || '').toLowerCase();
        return g === 'male' || g === 'female' ? g : 'unknown';
    };

    async function loadUser(uid) {
        const s = await db.collection('users').doc(uid).get();
        const d = s.data() || {};
        return { data: d, name: d.displayName || d.display_name || 'User', avatar: d.photoURL || d.avatarUrl || '', gender: genderOf(d) };
    }

    // Card owner picks exactly 3 personality traits (replaces the free-text bio).
    function readTraits(data) {
        const raw = Array.isArray(data?.traits) ? data.traits : [];
        const out = [];
        for (const item of raw) {
            const id = asTrimmed(item).toLowerCase();
            if (TRAIT_IDS.includes(id) && !out.includes(id)) out.push(id);
        }
        if (out.length !== TRAITS_REQUIRED) {
            throw new functions.https.HttpsError('invalid-argument', `Pick exactly ${TRAITS_REQUIRED} traits.`);
        }
        return out;
    }

    const emptyTally = () => ARCHETYPE_IDS.reduce((acc, id) => { acc[id] = 0; return acc; }, {});

    // ---- Publish a post (owner) ----------------------------------------------
    exports.createSuitabilityPost = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'suitability_create', { cooldownMs: 3000, perHour: 10, perDay: 20 });

        const me = await loadUser(uid);
        if (!me.avatar) throw new functions.https.HttpsError('failed-precondition', 'Add a profile photo first.');
        const traits = readTraits(data);

        // One active post per owner: return the existing live one instead of stacking.
        const existingId = asTrimmed(me.data.suitabilityActivePostId);
        if (existingId) {
            const ex = await db.collection('suitability_posts').doc(existingId).get();
            const now = Date.now();
            const exp = ex.exists ? (ex.data()?.expiresAt?.toMillis?.() ?? 0) : 0;
            if (ex.exists && ex.data()?.status === 'live' && exp > now) {
                return { postId: existingId, existing: true };
            }
        }

        const nowTs = FieldValue.serverTimestamp();
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + POST_TTL_MS);
        const ref = db.collection('suitability_posts').doc();
        await ref.set({
            ownerId: uid, ownerName: me.name, ownerAvatar: me.avatar, ownerGender: me.gender,
            traits, status: 'live', tally: emptyTally(), voteCount: 0, topArchetype: null,
            createdAt: nowTs, updatedAt: nowTs, expiresAt,
        });
        await db.collection('users').doc(uid).set({ suitabilityActivePostId: ref.id }, { merge: true });
        return { postId: ref.id };
    });

    async function requirePost(postId) {
        const ref = db.collection('suitability_posts').doc(postId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Post not found.');
        return { ref, post: s.data() || {} };
    }

    // ---- Vote an archetype (any viewer except the owner) ---------------------
    exports.voteSuitability = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'suitability_vote', { cooldownMs: 800, perMinute: 30 });
        const postId = asTrimmed(data?.postId);
        const archetype = asTrimmed(data?.archetype).toLowerCase();
        if (!ARCHETYPE_IDS.includes(archetype)) throw new functions.https.HttpsError('invalid-argument', 'Choose a valid type.');

        const ref = db.collection('suitability_posts').doc(postId);
        const voteRef = ref.collection('votes').doc(uid);
        const result = await db.runTransaction(async (tx) => {
            const ps = await tx.get(ref);
            if (!ps.exists) throw new functions.https.HttpsError('not-found', 'Post not found.');
            const post = ps.data() || {};
            if (post.ownerId === uid) throw new functions.https.HttpsError('failed-precondition', 'You cannot vote on your own card.');
            if (post.status !== 'live' || (post.expiresAt?.toMillis?.() ?? 0) <= Date.now()) {
                throw new functions.https.HttpsError('failed-precondition', 'This poll has ended.');
            }
            // A vote is FINAL — it can never be changed (changing would let people
            // rig the result and destroy its credibility). If a vote already exists,
            // keep it and report back the locked choice; never move the tally.
            const vs = await tx.get(voteRef);
            if (vs.exists) {
                return { changed: false, locked: true, archetype: String(vs.data()?.archetype || '') };
            }

            const inc = {};
            inc[`tally.${archetype}`] = FieldValue.increment(1);
            inc.voteCount = FieldValue.increment(1);
            inc.updatedAt = FieldValue.serverTimestamp();
            tx.set(voteRef, { uid, archetype, at: FieldValue.serverTimestamp() });
            tx.update(ref, inc);
            return { changed: true, locked: true, archetype };
        });
        return { ok: true, ...result };
    });

    // ---- End early (owner) ----------------------------------------------------
    exports.endSuitabilityPost = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, post } = await requirePost(asTrimmed(data?.postId));
        if (post.ownerId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the owner can end this.');
        await ref.update({ status: 'ended', updatedAt: FieldValue.serverTimestamp() });
        try {
            const uref = db.collection('users').doc(uid);
            const s = await uref.get();
            if (s.exists && s.data()?.suitabilityActivePostId === ref.id) await uref.update({ suitabilityActivePostId: null });
        } catch (err) { console.warn('[suitability] clear pointer', err?.message || err); }
        return { ok: true };
    });
}

module.exports = { registerSuitabilityPost };
