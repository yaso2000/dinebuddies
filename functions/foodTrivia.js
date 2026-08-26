const functions = require('firebase-functions');
const { GoogleAuth } = require('google-auth-library');

/**
 * Business Food Trivia — a live quiz the business hosts on its Stage's top panel
 * (the Stage chat stays live below). Included in the paid business plan (no
 * credits). Players = whoever is in the Stage and answers; scoring rewards being
 * correct AND fast.
 *
 * Peek-proof: the correct answer is NEVER sent to clients before the reveal. The
 * game doc stores question text/options only (no correctIndex); trivia_questions
 * is server-only; the server reads the correct answer at reveal time and writes
 * the revealed tally into the game doc.
 */
const ROUND_MS = 15000;   // 15s per question (up to 4 options)
const GRACE_MS = 1500;
const DEFAULT_ROUNDS = 8;
const MIN_ROUNDS = 4;
const MAX_ROUNDS = 16;
const BASE_POINTS = 500;    // for a correct answer
const SPEED_POINTS = 500;   // additional, scaled by how fast

function registerFoodTrivia(exports, { db, admin, enforceCallableRateLimit }) {
    const FieldValue = admin.firestore.FieldValue;
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    const shuffle = (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    async function loadUser(uid) {
        const s = await db.collection('users').doc(uid).get();
        const d = s.data() || {};
        return {
            data: d,
            name: d.displayName || d.display_name || 'Player',
            avatar: d.photoURL || d.avatarUrl || '',
        };
    }

    const isPaidBusiness = (d) => {
        const isBiz = d.role === 'business' || d.isBusiness === true || d.accountType === 'business';
        const paid = String(d.subscriptionTier || 'free').toLowerCase() === 'paid';
        return isBiz && paid;
    };

    /** Public question projection (NO correctIndex — that stays server-side).
     *  Includes the global bank plus the hosting business's own AI questions. */
    async function pickQuestions(count, ownerId) {
        const snap = await db.collection('trivia_questions').where('active', '==', true).get();
        const all = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() || {}) }))
            .filter((q) => q.text && Array.isArray(q.options?.en))
            .filter((q) => !q.ownerBusinessId || q.ownerBusinessId === ownerId);
        // Bias toward the business's own questions when it has them.
        const own = all.filter((q) => q.ownerBusinessId === ownerId);
        const global = all.filter((q) => !q.ownerBusinessId);
        const ordered = [...shuffle(own), ...shuffle(global)];
        return ordered.slice(0, count).map((q) => ({ id: q.id, text: q.text, options: q.options }));
    }

    const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
    const GEMINI_LOCATION = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';
    function resolveProjectId() {
        return process.env.GCLOUD_PROJECT?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim()
            || (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return ''; } })()
            || 'dinebuddies';
    }
    async function callGeminiJson(prompt) {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const url = `https://${GEMINI_LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveProjectId()}/locations/${GEMINI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
        const res = await client.request({
            url, method: 'POST',
            data: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } },
        });
        const raw = String(res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        try { return JSON.parse(raw); } catch { const a = raw.indexOf('['); const b = raw.lastIndexOf(']'); return JSON.parse(raw.slice(a, b + 1)); }
    }

    async function requireGame(gameId) {
        const ref = db.collection('trivia_games').doc(gameId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Game not found.');
        return { ref, game: s.data() || {} };
    }

    const assertHost = (game, uid) => {
        if (game.hostId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the host can do that.');
    };

    // ---- Start (business Stage host, paid plan) -------------------------------
    exports.startTriviaGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'trivia_start', { cooldownMs: 3000, perHour: 40 });

        const stageId = asTrimmed(data?.stageId);
        if (!stageId) throw new functions.https.HttpsError('invalid-argument', 'stageId is required.');
        const stageSnap = await db.collection('stages').doc(stageId).get();
        if (!stageSnap.exists) throw new functions.https.HttpsError('not-found', 'Stage not found.');
        const stage = stageSnap.data() || {};
        if (stage.hostId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the Stage host can start trivia.');

        const me = await loadUser(uid);
        if (!isPaidBusiness(me.data)) {
            throw new functions.https.HttpsError('failed-precondition', 'Food trivia is included in the paid business plan.');
        }
        // One active trivia per stage.
        if (asTrimmed(stage.activeTriviaGameId)) {
            const ex = await db.collection('trivia_games').doc(stage.activeTriviaGameId).get();
            if (ex.exists && ex.data()?.status !== 'finished') return { gameId: stage.activeTriviaGameId, existing: true };
        }

        let rounds = Number(data?.roundCount) || DEFAULT_ROUNDS;
        rounds = Math.min(Math.max(Math.round(rounds), MIN_ROUNDS), MAX_ROUNDS);
        const questions = await pickQuestions(rounds, uid);
        if (questions.length < MIN_ROUNDS) throw new functions.https.HttpsError('failed-precondition', 'Trivia bank unavailable.');

        const now = FieldValue.serverTimestamp();
        const ref = db.collection('trivia_games').doc();
        await ref.set({
            type: 'food_trivia',
            stageId,
            hostId: uid,
            hostName: me.name,
            status: 'active',            // active | finished
            questions,                    // NO correctIndex
            roundCount: questions.length,
            currentRound: 0,
            roundStatus: 'answering',     // answering | revealed
            roundEndsAt: admin.firestore.Timestamp.fromMillis(Date.now() + ROUND_MS),
            roundDurationMs: ROUND_MS,
            players: {},                  // filled as people answer
            reveal: {},
            result: null,
            createdAt: now,
            updatedAt: now,
        });
        await db.collection('stages').doc(stageId).set({ activeTriviaGameId: ref.id }, { merge: true });
        return { gameId: ref.id };
    });

    // ---- Submit (any Stage viewer) -------------------------------------------
    exports.submitTriviaAnswer = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        if (game.status !== 'active' || game.roundStatus !== 'answering') {
            throw new functions.https.HttpsError('failed-precondition', 'Not accepting answers right now.');
        }
        const round = Number(data?.round);
        if (round !== game.currentRound) throw new functions.https.HttpsError('failed-precondition', 'Round has moved on.');
        const endsAtMs = game.roundEndsAt?.toMillis?.();
        if (endsAtMs && Date.now() > endsAtMs + GRACE_MS) {
            throw new functions.https.HttpsError('deadline-exceeded', "Time's up for this question.");
        }
        const optionIndex = Number(data?.optionIndex);
        const optCount = game.questions?.[round]?.options?.en?.length || 4;
        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= optCount) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid option.');
        }

        const ansRef = ref.collection('answers').doc(`${round}_${uid}`);
        const existing = await ansRef.get();
        if (existing.exists) return { ok: true }; // trivia answers are final (no changing after lock-in)

        const me = await loadUser(uid);
        const now = FieldValue.serverTimestamp();
        await ansRef.set({ round, uid, optionIndex, submittedAtMs: Date.now(), submittedAt: now });
        // Register the player if new (score filled at reveal).
        if (!game.players?.[uid]) {
            await ref.update({ [`players.${uid}`]: { name: me.name, avatar: me.avatar, score: 0 }, updatedAt: now });
        }
        return { ok: true };
    });

    // ---- Advance (host): answering -> revealed -> next / finish ---------------
    exports.advanceTriviaGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);
        if (game.status !== 'active') throw new functions.https.HttpsError('failed-precondition', 'Game is not active.');

        const round = game.currentRound;
        const now = FieldValue.serverTimestamp();

        if (game.roundStatus === 'answering') {
            // Read the correct answer (server-only) and score everyone.
            const qId = game.questions?.[round]?.id;
            let correctIndex = -1;
            if (qId) {
                const qSnap = await db.collection('trivia_questions').doc(qId).get();
                correctIndex = Number(qSnap.data()?.correctIndex);
                if (!Number.isInteger(correctIndex)) correctIndex = -1;
            }
            const endsAtMs = game.roundEndsAt?.toMillis?.() || Date.now();
            const duration = Number(game.roundDurationMs) || ROUND_MS;

            const ansSnap = await ref.collection('answers').where('round', '==', round).get();
            const picks = {};
            const counts = {};
            const scoreUpdates = {};
            ansSnap.forEach((d) => {
                const a = d.data() || {};
                const opt = a.optionIndex;
                picks[a.uid] = opt;
                counts[opt] = (counts[opt] || 0) + 1;
                if (opt === correctIndex) {
                    const timeLeft = Math.max(0, endsAtMs - Number(a.submittedAtMs || endsAtMs));
                    const bonus = Math.round(SPEED_POINTS * Math.min(1, timeLeft / duration));
                    scoreUpdates[`players.${a.uid}.score`] = FieldValue.increment(BASE_POINTS + bonus);
                }
            });
            await ref.update({
                roundStatus: 'revealed',
                [`reveal.${round}`]: { correctIndex, counts, picks },
                ...scoreUpdates,
                updatedAt: now,
            });
            return { ok: true, phase: 'revealed' };
        }

        // revealed -> next or finish
        const nextRound = round + 1;
        if (nextRound < game.roundCount) {
            await ref.update({
                currentRound: nextRound,
                roundStatus: 'answering',
                roundEndsAt: admin.firestore.Timestamp.fromMillis(Date.now() + (Number(game.roundDurationMs) || ROUND_MS)),
                updatedAt: now,
            });
            return { ok: true, phase: 'next', round: nextRound };
        }
        const result = buildResult(game);
        // Keep the stage pointer so the results screen stays visible until the
        // host closes it (clearing it here would make the game vanish instantly).
        await ref.update({ status: 'finished', roundStatus: 'revealed', result, updatedAt: now });
        return { ok: true, phase: 'finished' };
    });

    function buildResult(game) {
        const players = game.players || {};
        const ranking = Object.entries(players)
            .map(([uid, p]) => ({ uid, name: p.name || 'Player', avatar: p.avatar || '', score: p.score || 0 }))
            .sort((x, y) => (y.score - x.score) || (x.uid < y.uid ? -1 : 1));
        return {
            ranking,
            winnerId: ranking[0]?.uid || null,
            winnerName: ranking[0]?.name || null,
            winnerScore: ranking[0]?.score || 0,
        };
    }

    async function clearStagePointer(stageId, gameId) {
        try {
            const sref = db.collection('stages').doc(stageId);
            const s = await sref.get();
            if (s.exists && s.data()?.activeTriviaGameId === gameId) {
                await sref.update({ activeTriviaGameId: FieldValue.delete() });
            }
        } catch (err) { console.warn('[foodTrivia] clear pointer', err?.message || err); }
    }

    // ---- AI: generate the business's own trivia questions --------------------
    exports.generateTriviaQuestions = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'trivia_generate', { cooldownMs: 4000, perHour: 20, perDay: 60 });
        const me = await loadUser(uid);
        if (!isPaidBusiness(me.data)) throw new functions.https.HttpsError('failed-precondition', 'AI question generation is included in the paid business plan.');

        const topic = asTrimmed(data?.topic).slice(0, 400);
        let count = Number(data?.count) || 5;
        count = Math.min(Math.max(Math.round(count), 1), 10);
        const bizName = me.data.displayName || me.data.businessName || '';
        const cuisine = me.data.cuisineType || me.data.cuisine || '';

        const prompt = [
            `Create ${count} fun multiple-choice FOOD trivia questions for a live restaurant game.`,
            topic ? `Focus/context (the business menu or theme): """${topic}"""` : (cuisine ? `Cuisine style: ${cuisine}.` : 'General food & cuisine knowledge.'),
            bizName ? `Hosted by: ${bizName}.` : '',
            'Each question: exactly 4 options, exactly ONE correct, general enough that guests can reason about it (not obscure).',
            'Provide BOTH Arabic (ar) and English (en) for the question text and all 4 options, in the SAME option order.',
            'Return a JSON array only, each item exactly:',
            '{"ar":"...","en":"...","optionsAr":["","","",""],"optionsEn":["","","",""],"correctIndex":0}',
        ].filter(Boolean).join('\n');

        let arr;
        try { arr = await callGeminiJson(prompt); }
        catch (err) { console.error('[foodTrivia] gemini', err?.message || err); throw new functions.https.HttpsError('internal', 'Generation failed. Please try again.'); }
        if (!Array.isArray(arr)) throw new functions.https.HttpsError('internal', 'Unexpected AI response.');

        const now = FieldValue.serverTimestamp();
        const batch = db.batch();
        const created = [];
        for (const q of arr.slice(0, count)) {
            const ar = asTrimmed(q?.ar), en = asTrimmed(q?.en);
            const oAr = Array.isArray(q?.optionsAr) ? q.optionsAr.map((x) => String(x)) : [];
            const oEn = Array.isArray(q?.optionsEn) ? q.optionsEn.map((x) => String(x)) : [];
            const ci = Number(q?.correctIndex);
            if (!en || oEn.length !== 4 || oAr.length !== 4 || !Number.isInteger(ci) || ci < 0 || ci > 3) continue;
            const ref = db.collection('trivia_questions').doc();
            batch.set(ref, {
                category: 'food', type: 'quiz', difficulty: 1, correctIndex: ci,
                text: { ar: ar || en, en }, options: { ar: oAr, en: oEn },
                active: true, ownerBusinessId: uid, source: 'ai', createdAt: now,
            });
            created.push({ id: ref.id, text: { ar: ar || en, en } });
        }
        if (!created.length) throw new functions.https.HttpsError('internal', 'No valid questions were produced. Try again.');
        await batch.commit();
        return { ok: true, created: created.length };
    });

    // ---- List / delete the business's own questions --------------------------
    exports.listMyTriviaQuestions = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const snap = await db.collection('trivia_questions').where('ownerBusinessId', '==', uid).limit(200).get();
        const items = snap.docs.map((d) => {
            const q = d.data() || {};
            return { id: d.id, text: q.text || {}, options: q.options || {}, correctIndex: q.correctIndex, source: q.source || 'ai' };
        });
        return { items };
    });

    exports.deleteMyTriviaQuestion = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const qid = asTrimmed(data?.questionId);
        if (!qid) throw new functions.https.HttpsError('invalid-argument', 'questionId is required.');
        const ref = db.collection('trivia_questions').doc(qid);
        const s = await ref.get();
        if (!s.exists || s.data()?.ownerBusinessId !== uid) throw new functions.https.HttpsError('permission-denied', 'Not your question.');
        await ref.delete();
        return { ok: true };
    });

    // ---- End early (host) -----------------------------------------------------
    exports.endTriviaGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);
        if (game.status === 'finished') return { ok: true };
        const result = buildResult(game);
        // Finish + show results; the pointer is cleared later by closeTriviaGame.
        await ref.update({ status: 'finished', roundStatus: 'revealed', result, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true };
    });

    // ---- Close the results (host) — dismiss the panel, restore the banner ----
    exports.closeTriviaGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);
        if (game.status !== 'finished') {
            const result = buildResult(game);
            await ref.update({ status: 'finished', roundStatus: 'revealed', result, updatedAt: FieldValue.serverTimestamp() });
        }
        await clearStagePointer(game.stageId, ref.id);
        return { ok: true };
    });
}

module.exports = { registerFoodTrivia };
