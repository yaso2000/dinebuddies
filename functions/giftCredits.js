/**
 * Profile gifts — atomic settlement:
 * 1) Credit recipient savings wallet (delivery)
 * 2) Debit sender purchase wallet
 * 3) Mark gift completed + idempotency lock
 * All steps share one Firestore transaction — any failure rolls back entirely.
 */
const crypto = require('crypto');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
    spendCreditsInTransaction,
    grantSavedCreditsInTransaction,
    computeGiftSavedAmount,
    isBusinessUserDoc,
    FieldValue,
} = require('./creditsCore');
const { resolveProfileGiftAmount, isKnownProfileGiftId } = require('./profileGiftCatalog');

const db = admin.firestore();

const MIN_GIFT_AMOUNT = 10;
const MAX_GIFT_AMOUNT = 5000;
const IDEMPOTENCY_KEY_MAX = 128;

/**
 * @param {import('firebase-functions').https.CallableContext} context
 */
function requireAuthUid(context) {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }
    return context.auth.uid;
}

function sanitizeIdempotencyKey(raw) {
    const key = String(raw || '')
        .trim()
        .replace(/[^\w.-]/g, '')
        .slice(0, IDEMPOTENCY_KEY_MAX);
    return key.length >= 8 ? key : '';
}

function buildIdempotencyDocId(senderId, idempotencyKey) {
    const digest = crypto
        .createHash('sha256')
        .update(`${senderId}:${idempotencyKey}`)
        .digest('hex')
        .slice(0, 48);
    return `${senderId}_${digest}`;
}

/**
 * @param {unknown} err
 */
function mapGiftError(err) {
    const code = String(err?.code || err?.message || '');
    if (code === 'INSUFFICIENT_CREDITS') {
        return new functions.https.HttpsError(
            'failed-precondition',
            'INSUFFICIENT_CREDITS',
            { code: 'INSUFFICIENT_CREDITS' }
        );
    }
    if (code === 'RECIPIENT_NOT_FOUND') {
        return new functions.https.HttpsError('not-found', 'Recipient not found.');
    }
    if (code === 'SENDER_NOT_FOUND') {
        return new functions.https.HttpsError('not-found', 'Sender not found.');
    }
    if (code === 'INVALID_GIFT') {
        return new functions.https.HttpsError('invalid-argument', 'Unknown or invalid gift.');
    }
    if (code === 'IDEMPOTENCY_KEY_REQUIRED') {
        return new functions.https.HttpsError('invalid-argument', 'idempotencyKey is required.');
    }
    return err;
}

/**
 * @param {Record<string, unknown>|undefined} data
 */
function buildCompletedResult(data) {
    return {
        ok: true,
        giftId: data?.giftDocId,
        sentAmount: data?.sentAmount,
        savedAmount: data?.savedAmount,
        recipientId: data?.recipientId,
        status: 'completed',
        idempotentReplay: true,
    };
}

function registerProfileGiftCallables(exportsObj) {
    exportsObj.sendProfileGift = functions.https.onCall(async (data, context) => {
        const senderId = requireAuthUid(context);
        const recipientId = String(data?.recipientId || data?.targetUserId || '').trim();
        const giftId = String(data?.giftId || data?.giftTypeId || '').trim().slice(0, 64) || null;
        const idempotencyKey = sanitizeIdempotencyKey(data?.idempotencyKey);

        if (!idempotencyKey) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'idempotencyKey is required (min 8 safe characters).'
            );
        }
        if (!recipientId) {
            throw new functions.https.HttpsError('invalid-argument', 'recipientId is required.');
        }
        if (recipientId === senderId) {
            throw new functions.https.HttpsError('invalid-argument', 'Cannot gift yourself.');
        }
        if (giftId && !isKnownProfileGiftId(giftId)) {
            throw new functions.https.HttpsError('invalid-argument', 'Unknown gift type.');
        }

        const amount = resolveProfileGiftAmount(giftId, data?.amount);
        if (!Number.isFinite(amount) || amount < MIN_GIFT_AMOUNT || amount > MAX_GIFT_AMOUNT) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `Gift amount must be between ${MIN_GIFT_AMOUNT} and ${MAX_GIFT_AMOUNT}.`
            );
        }

        const savedAmount = computeGiftSavedAmount(amount);
        if (savedAmount <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Gift amount too small.');
        }

        const idempotencyDocId = buildIdempotencyDocId(senderId, idempotencyKey);
        const idempotencyRef = db.collection('profile_gift_idempotency').doc(idempotencyDocId);

        // Fast path: prior completed attempt with same idempotency key.
        const priorIdem = await idempotencyRef.get();
        if (priorIdem.exists && priorIdem.data()?.status === 'completed') {
            return buildCompletedResult(priorIdem.data());
        }

        const senderRef = db.collection('users').doc(senderId);
        const recipientRef = db.collection('users').doc(recipientId);
        const giftRef = db.collection('profile_gifts').doc();

        /** @type {{ ok: boolean, giftId: string, sentAmount: number, savedAmount: number, recipientId: string, status: string, idempotentReplay: boolean } | null} */
        let settlementResult = null;

        try {
            await db.runTransaction(async (tx) => {
                const idemSnap = await tx.get(idempotencyRef);
                if (idemSnap.exists && idemSnap.data()?.status === 'completed') {
                    settlementResult = buildCompletedResult(idemSnap.data());
                    return;
                }

                const [senderSnap, recipientSnap] = await Promise.all([
                    tx.get(senderRef),
                    tx.get(recipientRef),
                ]);

                if (!senderSnap.exists) {
                    const err = new Error('SENDER_NOT_FOUND');
                    err.code = 'SENDER_NOT_FOUND';
                    throw err;
                }
                if (!recipientSnap.exists) {
                    const err = new Error('RECIPIENT_NOT_FOUND');
                    err.code = 'RECIPIENT_NOT_FOUND';
                    throw err;
                }

                const sender = senderSnap.data() || {};
                const recipient = recipientSnap.data() || {};
                const senderRole = isBusinessUserDoc(sender) ? 'business' : 'user';
                const recipientRole = isBusinessUserDoc(recipient) ? 'business' : 'user';

                // Delivery first, then payment — both commit atomically or neither does.
                grantSavedCreditsInTransaction(tx, recipientRef, recipient, {
                    uid: recipientId,
                    accountRole: recipientRole,
                    credits: savedAmount,
                    type: 'gift_received',
                    reason: 'profile_gift_received',
                    relatedId: giftRef.id,
                    giftSentAmount: amount,
                });

                spendCreditsInTransaction(tx, senderRef, sender, {
                    uid: senderId,
                    accountRole: senderRole,
                    amount,
                    type: 'profile_gift_send',
                    reason: 'profile_gift_send',
                    relatedId: giftRef.id,
                });

                tx.set(giftRef, {
                    status: 'completed',
                    senderId,
                    recipientId,
                    sentAmount: amount,
                    savedAmount,
                    recipientValueRate: 0.5,
                    giftId,
                    senderDisplayName: String(
                        sender.display_name || sender.displayName || ''
                    ).slice(0, 80),
                    idempotencyKey,
                    idempotencyDocId,
                    deliveredAt: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp(),
                });

                settlementResult = {
                    ok: true,
                    giftId: giftRef.id,
                    sentAmount: amount,
                    savedAmount,
                    recipientId,
                    status: 'completed',
                    idempotentReplay: false,
                };

                tx.set(idempotencyRef, {
                    status: 'completed',
                    senderId,
                    recipientId,
                    giftDocId: giftRef.id,
                    sentAmount: amount,
                    savedAmount,
                    giftId,
                    idempotencyKey,
                    result: settlementResult,
                    createdAt: FieldValue.serverTimestamp(),
                });
            });
        } catch (err) {
            throw mapGiftError(err);
        }

        if (!settlementResult) {
            throw new functions.https.HttpsError('internal', 'Gift settlement did not complete.');
        }

        return settlementResult;
    });
}

module.exports = { registerProfileGiftCallables };
