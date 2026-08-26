const functions = require('firebase-functions');

/**
 * Group games engine (competitive, host-controlled).
 *
 * Phase 1 mode: `taste_match` — group compatibility. Everyone answers the same
 * this-or-that questions; after each round the server reveals the tally and
 * updates a "sync score" (how often each player matched others). At the end:
 * a winner (most in-sync with the group), a playful last place (the contrarian),
 * and the top compatible pair ("couple of the night").
 *
 * Peek-proof: raw picks live in an owner-only `answers` subcollection; the game
 * doc only ever receives the revealed tally AFTER the host closes a round. The
 * host who created the game controls it (start / advance / restart / kick),
 * but never sees others' picks early and never computes scores — the server does.
 */
const MAX_PLAYERS = 16; // keeps the whole group visible at once on mobile
const DEFAULT_ROUNDS = 6;
const MIN_ROUNDS = 4;
const MAX_ROUNDS = 12;
const MAX_INVITEES = 30;
const ROUND_MS = 10000;   // 10s per question (two options — plenty)
const GRACE_MS = 1500;    // network latency grace before the server rejects a late answer

function registerGroupGames(exports, { db, admin, enforceCallableRateLimit }) {
    const FieldValue = admin.firestore.FieldValue;
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    const genCode = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable 0/O/1/I
        let s = '';
        for (let i = 0; i < 5; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
        return s;
    };

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
            name: d.displayName || d.display_name || 'Player',
            avatar: d.photoURL || d.avatarUrl || '',
        };
    }

    /** Pick N random active choice-questions, embedding all locales for the clients. */
    async function pickQuestions(count) {
        const snap = await db.collection('compat_questions').where('active', '==', true).get();
        const all = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() || {}) }))
            .filter((q) => q.type === 'choice' && q.text && q.options);
        const picked = shuffle(all).slice(0, count);
        return picked.map((q) => ({ id: q.id, text: q.text, options: q.options }));
    }

    async function requireGame(gameId) {
        const ref = db.collection('group_games').doc(gameId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Game not found.');
        return { ref, game: s.data() || {} };
    }

    const isMutualFollow = (aFollowing, bFollowing, aId, bId) =>
        Array.isArray(aFollowing) && Array.isArray(bFollowing) &&
        aFollowing.includes(bId) && bFollowing.includes(aId);

    async function notifyGameInvite(recipientId, hostId, hostName, gameId) {
        try {
            await db.collection('notifications').add({
                userId: recipientId,
                type: 'group_game_invite',
                title: 'Game invite 🎮',
                message: `${hostName} invited you to a group game.`,
                actionUrl: `/group-game/${gameId}`,
                fromUserId: hostId,
                senderId: hostId,
                senderName: hostName,
                metadata: { source: 'group_game', gameId },
                createdAt: FieldValue.serverTimestamp(),
                read: false,
            });
        } catch (err) { console.warn('[groupGames] invite notify failed', err?.message || err); }
    }

    /** Clear the host's "active game" pointer (one game per host at a time). */
    async function clearHostPointer(hostId, gameId) {
        try {
            const uref = db.collection('users').doc(hostId);
            const snap = await uref.get();
            if (snap.exists && snap.data()?.hostActiveGameId === gameId) {
                await uref.update({ hostActiveGameId: FieldValue.delete() });
            }
        } catch (err) { console.warn('[groupGames] clear pointer failed', err?.message || err); }
    }

    // ---- Create ---------------------------------------------------------------
    exports.createGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'group_game_create', { cooldownMs: 3000, perHour: 30, perDay: 100 });

        const type = asTrimmed(data?.type) || 'taste_match';
        if (type !== 'taste_match') throw new functions.https.HttpsError('invalid-argument', 'Unsupported game type.');
        let rounds = Number(data?.roundCount) || DEFAULT_ROUNDS;
        rounds = Math.min(Math.max(Math.round(rounds), MIN_ROUNDS), MAX_ROUNDS);
        const visibility = asTrimmed(data?.visibility).toLowerCase() === 'invite_only' ? 'invite_only' : 'public';

        // One live game per host at a time. If they already host an unfinished
        // game, hand it back instead of creating a second.
        const hostSnap = await db.collection('users').doc(uid).get();
        const hostData = hostSnap.data() || {};
        const existingId = asTrimmed(hostData.hostActiveGameId);
        if (existingId) {
            const ex = await db.collection('group_games').doc(existingId).get();
            if (ex.exists && ex.data()?.status !== 'finished') {
                return { gameId: existingId, joinCode: ex.data().joinCode, existing: true };
            }
        }

        // Validate invitees (mutual follows only), like Stages.
        const rawInvitees = Array.isArray(data?.inviteeIds) ? data.inviteeIds : [];
        const candidates = [...new Set(rawInvitees.map((id) => asTrimmed(id)).filter((id) => id && id !== uid))].slice(0, MAX_INVITEES);
        const hostFollowing = Array.isArray(hostData.following) ? hostData.following : [];
        const validInvitees = [];
        for (const inviteeId of candidates) {
            const s = await db.collection('users').doc(inviteeId).get();
            if (!s.exists) continue;
            const u = s.data() || {};
            if (String(u.role || '').toLowerCase() === 'guest' || u.isGuest === true) continue;
            const blocked = Array.isArray(u.blockedUserIds) ? u.blockedUserIds : [];
            if (blocked.includes(uid)) continue;
            if (!isMutualFollow(hostFollowing, u.following, uid, inviteeId)) continue;
            validInvitees.push(inviteeId);
        }
        if (visibility === 'invite_only' && validInvitees.length === 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Invite at least one person for a private game.');
        }

        const questions = await pickQuestions(rounds);
        if (questions.length < MIN_ROUNDS) {
            throw new functions.https.HttpsError('failed-precondition', 'Question bank unavailable.');
        }
        const host = await loadUser(uid);
        const now = FieldValue.serverTimestamp();
        const ref = db.collection('group_games').doc();
        await ref.set({
            type,
            status: 'lobby', // lobby | active | finished
            visibility, // public | invite_only
            open: visibility === 'public', // public games surface in discovery
            invitedIds: validInvitees,
            hostId: uid,
            hostName: host.name,
            hostAvatar: host.avatar,
            joinCode: genCode(),
            questions,
            roundCount: questions.length,
            currentRound: -1,
            roundStatus: 'idle', // idle | answering | revealed
            roundEndsAt: null,
            playerIds: [uid],
            players: { [uid]: { name: host.name, avatar: host.avatar, score: 0, answered: false } },
            reveal: {},
            result: null,
            createdAt: now,
            updatedAt: now,
        });
        await db.collection('users').doc(uid).set({ hostActiveGameId: ref.id }, { merge: true });
        for (const inviteeId of validInvitees) await notifyGameInvite(inviteeId, uid, host.name, ref.id);
        return { gameId: ref.id, joinCode: (await ref.get()).data().joinCode };
    });

    // ---- Join (open to everyone; by id or code) -------------------------------
    exports.joinGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'group_game_join', { cooldownMs: 1500, perMinute: 20, perHour: 200 });

        let gameId = asTrimmed(data?.gameId);
        const code = asTrimmed(data?.joinCode).toUpperCase();
        if (!gameId && code) {
            const q = await db.collection('group_games').where('joinCode', '==', code).limit(1).get();
            if (q.empty) throw new functions.https.HttpsError('not-found', 'No game with that code.');
            gameId = q.docs[0].id;
        }
        if (!gameId) throw new functions.https.HttpsError('invalid-argument', 'gameId or joinCode is required.');

        const { ref, game } = await requireGame(gameId);
        if (game.status === 'finished') throw new functions.https.HttpsError('failed-precondition', 'This game has ended.');
        if ((game.playerIds || []).includes(uid)) return { gameId };
        // Private games: only the host or explicitly invited people may join.
        if (game.visibility === 'invite_only' && game.hostId !== uid && !((game.invitedIds || []).includes(uid))) {
            throw new functions.https.HttpsError('permission-denied', 'This is a private game — you need an invite.');
        }
        if (game.status !== 'lobby') throw new functions.https.HttpsError('failed-precondition', 'This game already started.');
        if ((game.playerIds || []).length >= MAX_PLAYERS) throw new functions.https.HttpsError('resource-exhausted', 'This game is full.');

        const me = await loadUser(uid);
        await ref.update({
            playerIds: FieldValue.arrayUnion(uid),
            [`players.${uid}`]: { name: me.name, avatar: me.avatar, score: 0, answered: false },
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { gameId };
    });

    const assertHost = (game, uid) => {
        if (game.hostId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the host can do that.');
    };

    // ---- Start (host) ---------------------------------------------------------
    exports.startGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);
        if (game.status !== 'lobby') throw new functions.https.HttpsError('failed-precondition', 'Already started.');
        // Minimum 3: with 2 players "most in sync with the group" is meaningless
        // (their agreement is symmetric). Two-player compatibility is the 1:1 journey.
        if ((game.playerIds || []).length < 3) throw new functions.https.HttpsError('failed-precondition', 'Need at least 3 players.');

        const clearedAnswered = {};
        for (const pid of game.playerIds) clearedAnswered[`players.${pid}.answered`] = false;
        await ref.update({
            status: 'active',
            currentRound: 0,
            roundStatus: 'answering',
            roundEndsAt: admin.firestore.Timestamp.fromMillis(Date.now() + ROUND_MS),
            ...clearedAnswered,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true };
    });

    // ---- Submit an answer (player) -------------------------------------------
    exports.submitGroupAnswer = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        if (!(game.playerIds || []).includes(uid)) throw new functions.https.HttpsError('permission-denied', 'You are not in this game.');
        if (game.status !== 'active' || game.roundStatus !== 'answering') {
            throw new functions.https.HttpsError('failed-precondition', 'Not accepting answers right now.');
        }
        const round = Number(data?.round);
        if (round !== game.currentRound) throw new functions.https.HttpsError('failed-precondition', 'Round has moved on.');
        // Enforce the 10s deadline (with a small grace for latency).
        const endsAtMs = game.roundEndsAt?.toMillis?.();
        if (endsAtMs && Date.now() > endsAtMs + GRACE_MS) {
            throw new functions.https.HttpsError('deadline-exceeded', "Time's up for this question.");
        }
        const optionIndex = Number(data?.optionIndex);
        if (![0, 1].includes(optionIndex)) throw new functions.https.HttpsError('invalid-argument', 'Invalid option.');

        const now = FieldValue.serverTimestamp();
        await ref.collection('answers').doc(`${round}_${uid}`).set({ round, uid, optionIndex, submittedAt: now });
        await ref.update({ [`players.${uid}.answered`]: true, updatedAt: now });
        return { ok: true };
    });

    // ---- Advance (host): answering -> revealed -> next / finish ---------------
    exports.advanceGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);
        if (game.status !== 'active') throw new functions.https.HttpsError('failed-precondition', 'Game is not active.');

        const round = game.currentRound;
        const now = FieldValue.serverTimestamp();

        // Step 1: close the answering phase -> compute & reveal this round's tally.
        if (game.roundStatus === 'answering') {
            const ansSnap = await ref.collection('answers').where('round', '==', round).get();
            const picks = {};
            const counts = [0, 0];
            ansSnap.forEach((d) => {
                const a = d.data() || {};
                if ([0, 1].includes(a.optionIndex)) { picks[a.uid] = a.optionIndex; counts[a.optionIndex] += 1; }
            });
            const majority = counts[0] === counts[1] ? -1 : (counts[0] > counts[1] ? 0 : 1);

            // Sync score: each answerer earns +1 for every OTHER player who chose
            // the same option this round (cumulative pairwise agreement).
            const scoreUpdates = {};
            for (const [pid, opt] of Object.entries(picks)) {
                const delta = counts[opt] - 1;
                if (delta > 0) scoreUpdates[`players.${pid}.score`] = FieldValue.increment(delta);
            }
            await ref.update({
                roundStatus: 'revealed',
                [`reveal.${round}`]: { counts, picks, majority },
                ...scoreUpdates,
                updatedAt: now,
            });
            return { ok: true, phase: 'revealed' };
        }

        // Step 2: move on from a revealed round.
        const nextRound = round + 1;
        if (nextRound < game.roundCount) {
            const clearedAnswered = {};
            for (const pid of game.playerIds) clearedAnswered[`players.${pid}.answered`] = false;
            await ref.update({
                currentRound: nextRound,
                roundStatus: 'answering',
                roundEndsAt: admin.firestore.Timestamp.fromMillis(Date.now() + ROUND_MS),
                ...clearedAnswered,
                updatedAt: now,
            });
            return { ok: true, phase: 'next', round: nextRound };
        }

        // Last round done -> compute final result from all answers.
        const result = await computeResult(ref, game);
        await ref.update({ status: 'finished', roundStatus: 'revealed', result, updatedAt: now });
        await clearHostPointer(game.hostId, ref.id);
        return { ok: true, phase: 'finished' };
    });

    /** Build the final ranking, contrarian, top pair and group compatibility %. */
    async function computeResult(ref, game) {
        const ansSnap = await ref.collection('answers').get();
        // answersByRound[r][uid] = optionIndex
        const byRound = {};
        ansSnap.forEach((d) => {
            const a = d.data() || {};
            if (!byRound[a.round]) byRound[a.round] = {};
            if ([0, 1].includes(a.optionIndex)) byRound[a.round][a.uid] = a.optionIndex;
        });

        const players = game.playerIds || [];
        const nameOf = (uid) => (game.players?.[uid]?.name) || 'Player';
        const avatarOf = (uid) => (game.players?.[uid]?.avatar) || '';

        // Each of the N questions is worth an equal 1/N share. On a question you
        // answered, you earn the fraction of the OTHER answerers who chose the same
        // option (1.0 = fully in sync). A question you did NOT answer earns 0 — so
        // every unanswered question costs you its full 1/N share.
        const N = Math.max(1, Number(game.roundCount) || Object.keys(byRound).length || 1);
        const qScore = {}; // summed per-question sync fraction (0..N)
        for (const uid of players) qScore[uid] = 0;
        const pairAgree = {}; // "a|b" -> agreements (for the top pair)
        const pairTotal = {}; // "a|b" -> rounds both answered
        let totalAgree = 0;
        let totalPairsRounds = 0;

        const roundKeys = Object.keys(byRound);
        for (const r of roundKeys) {
            const picks = byRound[r];
            const ids = Object.keys(picks);
            const answeredCount = ids.length;
            const optCount = {};
            for (const id of ids) optCount[picks[id]] = (optCount[picks[id]] || 0) + 1;
            for (const p of players) {
                if (picks[p] === undefined) continue; // unanswered → 0 for this question
                const others = answeredCount - 1;
                const same = (optCount[picks[p]] || 0) - 1;
                qScore[p] += others > 0 ? same / others : 0;
            }
            for (let i = 0; i < ids.length; i += 1) {
                for (let j = i + 1; j < ids.length; j += 1) {
                    const a = ids[i]; const b = ids[j];
                    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                    pairTotal[key] = (pairTotal[key] || 0) + 1;
                    totalPairsRounds += 1;
                    if (picks[a] === picks[b]) {
                        pairAgree[key] = (pairAgree[key] || 0) + 1;
                        totalAgree += 1;
                    }
                }
            }
        }

        const pctOf = (uid) => Math.round((100 * qScore[uid]) / N);
        const ranking = players
            .map((uid) => ({ uid, name: nameOf(uid), avatar: avatarOf(uid), pct: pctOf(uid) }))
            .sort((x, y) => (y.pct - x.pct) || (y.uid < x.uid ? 1 : -1));

        let topPair = null;
        for (const key of Object.keys(pairTotal)) {
            const pct = Math.round((100 * (pairAgree[key] || 0)) / pairTotal[key]);
            const [a, b] = key.split('|');
            if (!topPair || pct > topPair.pct) {
                topPair = { a, b, aName: nameOf(a), bName: nameOf(b), pct };
            }
        }
        const groupPct = totalPairsRounds ? Math.round((100 * totalAgree) / totalPairsRounds) : 0;

        return {
            ranking,
            winnerId: ranking[0]?.uid || null,
            winnerName: ranking[0]?.name || null,
            contrarianId: ranking.length > 1 ? ranking[ranking.length - 1].uid : null,
            contrarianName: ranking.length > 1 ? ranking[ranking.length - 1].name : null,
            topPair,
            groupPct,
        };
    }

    // ---- Kick a player (host) -------------------------------------------------
    exports.kickGroupPlayer = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);
        const targetId = asTrimmed(data?.targetId);
        if (!targetId || targetId === uid) throw new functions.https.HttpsError('invalid-argument', 'Invalid target.');
        await ref.update({
            playerIds: FieldValue.arrayRemove(targetId),
            [`players.${targetId}`]: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true };
    });

    // ---- Leave (player) -------------------------------------------------------
    exports.leaveGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        if (!(game.playerIds || []).includes(uid)) return { ok: true };
        if (game.hostId === uid && game.status !== 'finished') {
            // Host leaving an unfinished game ends it for everyone.
            await ref.update({ status: 'finished', updatedAt: FieldValue.serverTimestamp() });
            await clearHostPointer(uid, ref.id);
            return { ok: true, ended: true };
        }
        await ref.update({
            playerIds: FieldValue.arrayRemove(uid),
            [`players.${uid}`]: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true };
    });

    // ---- Delete / cancel (host) ----------------------------------------------
    exports.deleteGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);

        // Remove answers, then the game doc itself.
        const ansSnap = await ref.collection('answers').get();
        if (!ansSnap.empty) {
            const batch = db.batch();
            ansSnap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
        await ref.delete();
        await clearHostPointer(uid, ref.id);
        return { ok: true, deleted: true };
    });

    // ---- Restart (host) -------------------------------------------------------
    exports.restartGroupGame = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        const { ref, game } = await requireGame(asTrimmed(data?.gameId));
        assertHost(game, uid);

        // Wipe old answers.
        const ansSnap = await ref.collection('answers').get();
        const batch = db.batch();
        ansSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        const questions = await pickQuestions(game.roundCount || DEFAULT_ROUNDS);
        const resetPlayers = {};
        for (const pid of game.playerIds || []) {
            const p = game.players?.[pid] || {};
            resetPlayers[pid] = { name: p.name || 'Player', avatar: p.avatar || '', score: 0, answered: false };
        }
        await ref.update({
            status: 'lobby',
            currentRound: -1,
            roundStatus: 'idle',
            roundEndsAt: null,
            questions,
            roundCount: questions.length,
            players: resetPlayers,
            reveal: {},
            result: null,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true };
    });
}

module.exports = { registerGroupGames };
