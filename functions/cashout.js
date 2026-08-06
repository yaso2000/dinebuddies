/**
 * Shield-package cash-out (gift savings only).
 * - User requests a fixed shield tier (not an arbitrary amount).
 * - Deducts exact package cost from savedCredits; never touches totalSavedCreditsEarned.
 * - Creates pending cashout_requests; admin marks paid or rejects (refund on reject).
 * - No automatic PayPal transfer (store-safe: earnings review, then manual payout).
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getCashoutShieldTier } = require('./cashoutShieldTiers');
const { isBusinessUserDoc, FieldValue, db } = require('./creditsCore');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cashoutEnabled() {
    // Default OFF for store launch — set CASHOUT_ENABLED=true to reopen.
    const raw = String(process.env.CASHOUT_ENABLED || 'false').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

function requireAuthUid(context) {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }
    return context.auth.uid;
}

function normalizePaypalEmail(raw) {
    const email = String(raw || '')
        .trim()
        .toLowerCase()
        .slice(0, 200);
    if (!EMAIL_RE.test(email)) return '';
    return email;
}

async function writeUserNotification(uid, payload) {
    try {
        await db.collection('notifications').add({
            userId: uid,
            recipientId: uid,
            type: payload.type || 'cashout',
            title: payload.title || 'Cash-out update',
            message: payload.message || '',
            read: false,
            createdAt: FieldValue.serverTimestamp(),
            meta: payload.meta || null,
        });
    } catch (e) {
        functions.logger.warn('[cashout] notification failed', e?.message || e);
    }
}

/**
 * @param {Record<string, unknown>} exportsMap
 * @param {{ assertAdminContext: Function }} deps
 */
function registerCashoutCallables(exportsMap, deps) {
    const { assertAdminContext } = deps;

    /**
     * requestCashout({ shieldType, paypalEmail })
     */
    exportsMap.requestCashout = functions.https.onCall(async (data, context) => {
        if (!cashoutEnabled()) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Cash-out is not available right now.'
            );
        }

        const uid = requireAuthUid(context);
        const tier = getCashoutShieldTier(data?.shieldType);
        if (!tier) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Choose a valid Shield package (silver, gold, platinum, or diamond).'
            );
        }

        const paypalEmail = normalizePaypalEmail(data?.paypalEmail);
        if (!paypalEmail) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'A valid PayPal email is required.'
            );
        }

        const requestRef = db.collection('cashout_requests').doc();

        await db.runTransaction(async (tx) => {
            const userRef = db.collection('users').doc(uid);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) {
                throw new functions.https.HttpsError('failed-precondition', 'Profile not found.');
            }
            const user = userSnap.data() || {};
            if (isBusinessUserDoc(user)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Business accounts cannot request cash-out.'
                );
            }

            const existingPending = String(user.pendingCashoutRequestId || '').trim();
            if (existingPending) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'You already have a pending cash-out request.'
                );
            }

            const saved = Math.max(0, Math.floor(Number(user.savedCredits) || 0));
            if (saved < tier.amountCredits) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Insufficient savings credits. Need ${tier.amountCredits} for ${tier.defaultLabel} Shield.`
                );
            }

            const nextSaved = saved - tier.amountCredits;

            // STRICT: do not touch totalSavedCreditsEarned (visual shield progress).
            tx.update(userRef, {
                savedCredits: nextSaved,
                pendingCashoutRequestId: requestRef.id,
                updatedAt: FieldValue.serverTimestamp(),
            });

            const ledgerRef = db.collection('credit_transactions').doc();
            tx.set(ledgerRef, {
                userId: uid,
                accountRole: 'user',
                type: 'cashout_request',
                amount: -tier.amountCredits,
                balanceType: 'saved',
                wallet: 'savings',
                reason: `cashout_shield_${tier.id}`,
                relatedId: requestRef.id,
                createdAt: FieldValue.serverTimestamp(),
                paidUsed: 0,
                savedUsed: tier.amountCredits,
                freeUsed: 0,
                shieldType: tier.id,
                amountFiatUsd: tier.amountFiatUsd,
            });

            tx.set(requestRef, {
                userId: uid,
                shieldType: tier.id,
                amountCredits: tier.amountCredits,
                amountFiat: tier.amountFiatUsd,
                currency: 'USD',
                paypalEmail,
                status: 'pending',
                displayName: String(user.display_name || user.displayName || '').slice(0, 120),
                userEmail: String(user.email || context.auth?.token?.email || '').slice(0, 200),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                rejectReason: null,
                resolvedAt: null,
                resolvedBy: null,
            });
        });

        functions.logger.info('[requestCashout] created', {
            uid,
            requestId: requestRef.id,
            shieldType: tier.id,
            amountCredits: tier.amountCredits,
        });

        return {
            ok: true,
            requestId: requestRef.id,
            shieldType: tier.id,
            amountCredits: tier.amountCredits,
            amountFiat: tier.amountFiatUsd,
            status: 'pending',
        };
    });

    /**
     * resolveCashoutRequest({ requestId, action: 'paid'|'reject', rejectReason? })
     */
    exportsMap.resolveCashoutRequest = functions.https.onCall(async (data, context) => {
        const { requesterUid } = await assertAdminContext(context);
        const requestId = String(data?.requestId || '').trim();
        const action = String(data?.action || '')
            .trim()
            .toLowerCase();
        if (!requestId) {
            throw new functions.https.HttpsError('invalid-argument', 'requestId required.');
        }
        if (action !== 'paid' && action !== 'reject') {
            throw new functions.https.HttpsError('invalid-argument', 'action must be paid or reject.');
        }

        const rejectReason =
            action === 'reject'
                ? String(data?.rejectReason || '')
                      .trim()
                      .slice(0, 500)
                : '';

        let notifyUid = null;
        let notifyPayload = null;

        await db.runTransaction(async (tx) => {
            const requestRef = db.collection('cashout_requests').doc(requestId);
            const snap = await tx.get(requestRef);
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', 'Cash-out request not found.');
            }
            const req = snap.data() || {};
            if (req.status !== 'pending') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Request is already ${req.status}.`
                );
            }

            const uid = String(req.userId || '');
            const amountCredits = Math.max(0, Math.floor(Number(req.amountCredits) || 0));
            const shieldType = String(req.shieldType || '');
            notifyUid = uid;

            if (action === 'reject') {
                if (amountCredits > 0 && uid) {
                    const userRef = db.collection('users').doc(uid);
                    const userSnap = await tx.get(userRef);
                    if (userSnap.exists) {
                        const user = userSnap.data() || {};
                        const saved = Math.max(0, Math.floor(Number(user.savedCredits) || 0));
                        tx.update(userRef, {
                            savedCredits: saved + amountCredits,
                            pendingCashoutRequestId: FieldValue.delete(),
                            updatedAt: FieldValue.serverTimestamp(),
                        });

                        const ledgerRef = db.collection('credit_transactions').doc();
                        tx.set(ledgerRef, {
                            userId: uid,
                            accountRole: 'user',
                            type: 'cashout_reject_refund',
                            amount: amountCredits,
                            balanceType: 'saved',
                            wallet: 'savings',
                            reason: 'cashout_rejected_refund',
                            relatedId: requestId,
                            createdAt: FieldValue.serverTimestamp(),
                            paidUsed: 0,
                            savedUsed: 0,
                            freeUsed: 0,
                            shieldType,
                        });
                    }
                }

                tx.update(requestRef, {
                    status: 'rejected',
                    rejectReason: rejectReason || 'Rejected by admin',
                    resolvedAt: FieldValue.serverTimestamp(),
                    resolvedBy: requesterUid,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                notifyPayload = {
                    type: 'cashout_rejected',
                    title: 'Cash-out declined',
                    message: rejectReason
                        ? `Your ${shieldType} Shield cash-out was declined: ${rejectReason}`
                        : `Your ${shieldType} Shield cash-out was declined. Savings credits were restored.`,
                    meta: { requestId, shieldType, action: 'reject' },
                };
                return;
            }

            // paid — credits already deducted at request time; leave savings as-is.
            if (uid) {
                const userRef = db.collection('users').doc(uid);
                const userSnap = await tx.get(userRef);
                if (userSnap.exists) {
                    tx.update(userRef, {
                        pendingCashoutRequestId: FieldValue.delete(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                }
            }

            tx.update(requestRef, {
                status: 'paid',
                rejectReason: null,
                resolvedAt: FieldValue.serverTimestamp(),
                resolvedBy: requesterUid,
                updatedAt: FieldValue.serverTimestamp(),
            });

            notifyPayload = {
                type: 'cashout_paid',
                title: 'Cash-out approved',
                message: `Your ${shieldType} Shield cash-out ($${Number(req.amountFiat) || 0} USD) was marked as paid.`,
                meta: { requestId, shieldType, action: 'paid' },
            };
        });

        if (notifyUid && notifyPayload) {
            await writeUserNotification(notifyUid, notifyPayload);
        }

        return { ok: true, requestId, action };
    });
}

module.exports = {
    registerCashoutCallables,
    cashoutEnabled,
};
