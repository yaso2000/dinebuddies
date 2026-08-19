/**
 * Jar-package cash-out (gift savings only).
 * - User requests one or more Jar sizes (never an arbitrary amount) in a single combined request.
 * - Deducts exact total package cost from savedCredits; never touches totalSavedCreditsEarned.
 * - Creates one pending cashout_requests doc with an itemized breakdown; admin marks paid or rejects (refund on reject).
 * - No automatic PayPal transfer (store-safe: earnings review, then manual payout).
 */
const functions = require('firebase-functions');
const { getCashoutShieldTier } = require('./cashoutShieldTiers');
const { isBusinessUserDoc, FieldValue, db } = require('./creditsCore');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_JAR_COUNT_PER_TIER = 50;

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

/**
 * Validate and price the requested Jar items.
 * @param {unknown} rawItems
 * @returns {Array<{ shieldType: string, count: number, amountCredits: number, amountFiatUsd: number }>}
 */
function resolveCashoutItems(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [];
    const seen = new Set();
    const items = [];

    for (const raw of list) {
        const tier = getCashoutShieldTier(raw?.shieldType);
        if (!tier) {
            throw new functions.https.HttpsError('invalid-argument', 'Choose valid Jar packages.');
        }
        if (seen.has(tier.id)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Each Jar size may only appear once per request.'
            );
        }
        seen.add(tier.id);

        const count = Math.floor(Number(raw?.count));
        if (!Number.isFinite(count) || count < 1 || count > MAX_JAR_COUNT_PER_TIER) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `Jar quantity must be between 1 and ${MAX_JAR_COUNT_PER_TIER}.`
            );
        }

        items.push({
            shieldType: tier.id,
            count,
            amountCredits: tier.amountCredits * count,
            amountFiatUsd: Math.round(tier.amountFiatUsd * count * 100) / 100,
        });
    }

    if (!items.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Choose at least one Jar to cash out.');
    }

    return items;
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
     * requestCashout({ items: [{ shieldType, count }], paypalEmail })
     */
    exportsMap.requestCashout = functions.https.onCall(async (data, context) => {
        if (!cashoutEnabled()) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Cash-out is not available right now.'
            );
        }

        const uid = requireAuthUid(context);
        const items = resolveCashoutItems(data?.items);
        const totalCredits = items.reduce((sum, it) => sum + it.amountCredits, 0);
        const totalFiat = Math.round(items.reduce((sum, it) => sum + it.amountFiatUsd, 0) * 100) / 100;

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
            if (saved < totalCredits) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Insufficient savings credits. Need ${totalCredits}.`
                );
            }

            const nextSaved = saved - totalCredits;

            // STRICT: do not touch totalSavedCreditsEarned (visual shield progress).
            tx.update(userRef, {
                savedCredits: nextSaved,
                pendingCashoutRequestId: requestRef.id,
                updatedAt: FieldValue.serverTimestamp(),
            });

            for (const it of items) {
                const ledgerRef = db.collection('credit_transactions').doc();
                tx.set(ledgerRef, {
                    userId: uid,
                    accountRole: 'user',
                    type: 'cashout_request',
                    amount: -it.amountCredits,
                    balanceType: 'saved',
                    wallet: 'savings',
                    reason: `cashout_jar_${it.shieldType}`,
                    relatedId: requestRef.id,
                    createdAt: FieldValue.serverTimestamp(),
                    paidUsed: 0,
                    savedUsed: it.amountCredits,
                    freeUsed: 0,
                    shieldType: it.shieldType,
                    jarCount: it.count,
                    amountFiatUsd: it.amountFiatUsd,
                });
            }

            tx.set(requestRef, {
                userId: uid,
                items,
                amountCredits: totalCredits,
                amountFiat: totalFiat,
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
            items: items.map((it) => `${it.shieldType}x${it.count}`),
            amountCredits: totalCredits,
        });

        return {
            ok: true,
            requestId: requestRef.id,
            items,
            amountCredits: totalCredits,
            amountFiat: totalFiat,
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
            const itemsSummary = Array.isArray(req.items)
                ? req.items.map((it) => `${it.count}× ${it.shieldType}`).join(', ')
                : String(req.shieldType || '');
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
                        ? `Your Jar cash-out (${itemsSummary}) was declined: ${rejectReason}`
                        : `Your Jar cash-out (${itemsSummary}) was declined. Savings credits were restored.`,
                    meta: { requestId, items: req.items || null, action: 'reject' },
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
                message: `Your Jar cash-out (${itemsSummary}, $${Number(req.amountFiat) || 0} USD) was marked as paid.`,
                meta: { requestId, items: req.items || null, action: 'paid' },
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
