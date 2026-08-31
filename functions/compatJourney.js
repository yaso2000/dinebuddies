const functions = require('firebase-functions');

/**
 * Compatibility Journey — a two-player, staged getting-to-know-you game played
 * inside a 1:1 chat. Five levels of rising depth; each level both players answer
 * the same choice questions, answers are revealed side-by-side, a compatibility
 * % is computed, and a (tunable) threshold gates unlocking the next, deeper level.
 *
 * Peek-proof: raw per-user answers live in an owner-only subcollection; the
 * revealed comparison is written into the journey doc by the server only AFTER
 * both players have submitted, so neither can see the other's answers early.
 */
function registerCompatJourney(exports, { db, admin, enforceCallableRateLimit }) {
    const LEVELS = 5;
    // Per-level pass threshold (%). Tunable — deliberately not a single fixed 60.
    const LEVEL_THRESHOLDS = { 1: 50, 2: 55, 3: 60, 4: 65, 5: 70 };

    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');
    const journeyIdFor = (a, b) => [a, b].sort().join('_');

    const isBusiness = (d) => {
        if (!d) return false;
        const role = String(d.role || d.accountType || d.accountRole || '').toLowerCase();
        return role === 'business' || role === 'partner' || d.isBusiness === true;
    };

    async function loadActiveQuestionsByLevel() {
        const snap = await db.collection('compat_questions').where('active', '==', true).get();
        const byLevel = {};
        snap.forEach((doc) => {
            const q = doc.data() || {};
            const lvl = Number(q.level);
            if (!lvl) return;
            (byLevel[lvl] = byLevel[lvl] || []).push({ id: doc.id, order: Number(q.order) || 0, weight: Number(q.weight) || 1, type: q.type || 'choice' });
        });
        for (const lvl of Object.keys(byLevel)) {
            byLevel[lvl].sort((a, b) => a.order - b.order);
        }
        return byLevel;
    }

    exports.startCompatJourney = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        const uid = context.auth.uid;
        const otherUserId = asTrimmed(data?.otherUserId);
        if (!otherUserId) throw new functions.https.HttpsError('invalid-argument', 'otherUserId is required.');
        if (otherUserId === uid) throw new functions.https.HttpsError('invalid-argument', 'Cannot start a journey with yourself.');

        const [meSnap, otherSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('users').doc(otherUserId).get(),
        ]);
        if (!otherSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
        // Personal social game — not for business accounts (they use the Business inbox / Stage).
        if (isBusiness(meSnap.data()) || isBusiness(otherSnap.data())) {
            throw new functions.https.HttpsError('failed-precondition', 'This game is for personal accounts.');
        }

        const journeyId = journeyIdFor(uid, otherUserId);
        const ref = db.collection('compat_journeys').doc(journeyId);
        const existing = await ref.get();
        if (existing.exists) return { ok: true, journeyId };

        await enforceCallableRateLimit(uid, 'compat_start', { cooldownMs: 2000, perHour: 40, perDay: 200 });

        const byLevel = await loadActiveQuestionsByLevel();
        const questionsByLevel = {};
        for (let l = 1; l <= LEVELS; l += 1) {
            questionsByLevel[l] = (byLevel[l] || []).map((q) => q.id);
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        await ref.set({
            participants: [uid, otherUserId].sort(),
            startedBy: uid,
            levels: LEVELS,
            currentLevel: 1,
            unlockedLevel: 1,
            status: 'active', // active | reveal | level_failed | completed
            questionsByLevel,
            thresholds: LEVEL_THRESHOLDS,
            perLevel: {},
            overallCompat: null,
            culminated: false,
            createdAt: now,
            updatedAt: now,
        });

        // Break the silence: invite the other player (in-app + FCM push).
        const starterName =
            asTrimmed(meSnap.data()?.displayName) ||
            asTrimmed(meSnap.data()?.display_name) ||
            asTrimmed(meSnap.data()?.firstName) ||
            'Someone';
        await notifyUser(
            otherUserId, uid, journeyId, 'compat_invite',
            'Play with me 💗',
            `${starterName} wants to play the Compatibility Journey with you.`
        );

        return { ok: true, journeyId };
    });

    exports.submitCompatAnswers = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        const uid = context.auth.uid;
        const journeyId = asTrimmed(data?.journeyId);
        const level = Number(data?.level);
        const answers = data?.answers && typeof data.answers === 'object' ? data.answers : null;
        if (!journeyId) throw new functions.https.HttpsError('invalid-argument', 'journeyId is required.');
        if (!Number.isInteger(level) || level < 1 || level > LEVELS) throw new functions.https.HttpsError('invalid-argument', 'Invalid level.');
        if (!answers) throw new functions.https.HttpsError('invalid-argument', 'answers is required.');

        const ref = db.collection('compat_journeys').doc(journeyId);
        const snap = await ref.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Journey not found.');
        const journey = snap.data() || {};
        const participants = Array.isArray(journey.participants) ? journey.participants : [];
        if (!participants.includes(uid)) throw new functions.https.HttpsError('permission-denied', 'Not a participant.');
        if (level > (journey.unlockedLevel || 1)) throw new functions.https.HttpsError('failed-precondition', 'This level is not unlocked yet.');

        await enforceCallableRateLimit(uid, 'compat_submit', { cooldownMs: 1000, perMinute: 30, perDay: 1000 });

        const otherUid = participants.find((p) => p !== uid);
        const now = admin.firestore.FieldValue.serverTimestamp();

        // Sanitize answers to { qid: numericOptionIndex } limited to this level's questions.
        const levelQ = Array.isArray(journey.questionsByLevel?.[level]) ? journey.questionsByLevel[level] : [];
        const cleanAnswers = {};
        for (const qid of levelQ) {
            const v = answers[qid];
            if (Number.isInteger(v) && v >= 0 && v < 20) cleanAnswers[qid] = v;
        }

        const myAnsRef = ref.collection('answers').doc(`${level}_${uid}`);
        await myAnsRef.set({ level, uid, answers: cleanAnswers, submittedAt: now });

        const otherAnsSnap = await ref.collection('answers').doc(`${level}_${otherUid}`).get();
        if (!otherAnsSnap.exists) {
            // Waiting for the other player. Nudge them.
            await ref.update({ [`perLevel.${level}.pendingFor`]: otherUid, status: 'active', updatedAt: now });
            await notifyUser(otherUid, uid, journeyId, 'compat_turn', 'Your turn 💬', 'Your partner answered — your turn in the journey.');
            return { ok: true, bothSubmitted: false };
        }

        // Both submitted → compute compatibility for this level.
        const otherAns = otherAnsSnap.data()?.answers || {};
        let matchedWeight = 0;
        let totalWeight = 0;
        const reveal = {};
        // Pull weights for the level's questions.
        const qDocs = await Promise.all(levelQ.map((qid) => db.collection('compat_questions').doc(qid).get()));
        const weightById = {};
        qDocs.forEach((d) => { if (d.exists) weightById[d.id] = Number(d.data()?.weight) || 1; });

        for (const qid of levelQ) {
            const w = weightById[qid] || 1;
            const mine = cleanAnswers[qid];
            const theirs = otherAns[qid];
            reveal[qid] = { [uid]: mine ?? null, [otherUid]: theirs ?? null };
            if (mine == null || theirs == null) continue; // unanswered doesn't count toward total
            totalWeight += w;
            if (mine === theirs) matchedWeight += w;
        }
        const compatPct = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
        const threshold = LEVEL_THRESHOLDS[level] || 60;
        // The score no longer gates progress: every level advances regardless of the
        // percentage. The % is always revealed, and the final result rates the match
        // by the overall %. `hitThreshold` is kept only as an informational flag.
        const hitThreshold = compatPct >= threshold;
        const passed = true;

        const updates = {
            [`perLevel.${level}`]: {
                compatPct,
                passed,
                hitThreshold,
                threshold,
                reveal,
                computedAt: now,
            },
            updatedAt: now,
        };

        if (passed) {
            if (level >= LEVELS) {
                updates.status = 'completed';
                updates.culminated = true;
                updates.currentLevel = LEVELS;
            } else {
                updates.status = 'active';
                updates.unlockedLevel = Math.max(journey.unlockedLevel || 1, level + 1);
                updates.currentLevel = level + 1;
            }
        } else {
            updates.status = 'level_failed'; // retry allowed by resubmitting this level
        }

        // Running overall average across computed levels.
        const computed = { ...(journey.perLevel || {}) };
        computed[level] = { compatPct, passed };
        const pcts = Object.values(computed).map((x) => Number(x.compatPct)).filter((n) => Number.isFinite(n));
        updates.overallCompat = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : compatPct;

        await ref.update(updates);

        const isFinal = level >= LEVELS;
        await notifyUser(
            otherUid, uid, journeyId,
            'compat_reveal',
            isFinal ? 'Journey complete 💗' : 'Level unlocked 💗',
            isFinal
                ? `Your overall match is ${updates.overallCompat}%!`
                : `You matched ${compatPct}% — the next level is open!`
        );

        return { ok: true, bothSubmitted: true, compatPct, passed, hitThreshold, completed: isFinal };
    });

    // Restart: wipe the journey and its answers so the pair can play fresh.
    exports.resetCompatJourney = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        const uid = context.auth.uid;
        const otherUserId = asTrimmed(data?.otherUserId);
        if (!otherUserId) throw new functions.https.HttpsError('invalid-argument', 'otherUserId is required.');

        const journeyId = journeyIdFor(uid, otherUserId);
        const ref = db.collection('compat_journeys').doc(journeyId);
        const snap = await ref.get();
        if (!snap.exists) return { ok: true };
        const participants = Array.isArray(snap.data()?.participants) ? snap.data().participants : [];
        if (!participants.includes(uid)) throw new functions.https.HttpsError('permission-denied', 'Not a participant.');

        await enforceCallableRateLimit(uid, 'compat_reset', { cooldownMs: 3000, perHour: 30, perDay: 100 });

        const ansSnap = await ref.collection('answers').get();
        const batch = db.batch();
        ansSnap.forEach((d) => batch.delete(d.ref));
        batch.delete(ref);
        await batch.commit();

        await notifyUser(otherUserId, uid, journeyId, 'compat_reset', 'Journey restarted 🔄', 'Your partner restarted the compatibility journey.');
        return { ok: true };
    });

    async function notifyUser(recipientId, fromUid, journeyId, type, title, message) {
        try {
            const now = admin.firestore.FieldValue.serverTimestamp();
            await db.collection('notifications').add({
                userId: recipientId,
                type,
                title,
                message,
                actionUrl: `/compat/${fromUid}`,
                fromUserId: fromUid,
                senderId: fromUid,
                metadata: { source: 'compat_journey', journeyId },
                createdAt: now,
                read: false,
            });
        } catch (err) {
            console.warn('[compat] notify failed', err?.message || err);
        }
    }
}

module.exports = { registerCompatJourney };
