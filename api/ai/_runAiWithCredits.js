import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { spendCreditsInTransaction, isBusinessUserDoc } from '../_dineCredits.js';
import { planAiCreditRefund } from '../_dineCreditsSpendMath.js';
import { ensureFirebaseAdmin } from '../_firebaseAdmin.js';
import { resolveCreditCost, resolveLedgerAiType } from './aiCredits.js';

/**
 * Spend credits inside a transaction and return user profile data for Stage 0 context.
 *
 * @param {string} uid
 * @param {{ generationPackage?: string, postType?: string, reasonSuffix?: string }} opts
 */
export async function spendAiCredits(uid, opts) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const creditCost = resolveCreditCost(opts.generationPackage, opts.postType);
    const aiType = resolveLedgerAiType(opts.generationPackage, opts.postType);

    const spendResult = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            return { ok: false };
        }

        const userData = snap.data();
        const accountRole = isBusinessUserDoc(userData) ? 'business' : 'user';

        try {
            const spent = spendCreditsInTransaction(tx, db, userRef, userData, {
                uid,
                accountRole,
                amount: creditCost,
                type: aiType,
                reason: `ai_generate_${opts.reasonSuffix || opts.postType || opts.generationPackage || 'text'}`,
                allowSavedCredits: true,
            });
            return {
                ok: true,
                freeUsed: spent.freeUsed,
                paidUsed: spent.paidUsed,
                savedUsed: spent.savedUsed,
                userData,
                creditCost,
            };
        } catch (spendErr) {
            if (spendErr?.code === 'INSUFFICIENT_CREDITS') {
                return { ok: false, insufficient: true, creditCost };
            }
            throw spendErr;
        }
    });

    return { db, userRef, ...spendResult };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/firestore').DocumentReference} userRef
 * @param {{ freeUsed?: number, paidUsed?: number, savedUsed?: number } | null} charged
 */
export async function refundAiCredits(db, userRef, charged) {
    const planned = planAiCreditRefund(charged);
    if (!planned.shouldRefund) {
        return;
    }

    /** @type {Record<string, unknown>} */
    const patch = {
        updatedAt: FieldValue.serverTimestamp(),
    };
    // Failsafe: restore exact wallets used. Never touch totalSavedCreditsEarned.
    if (planned.paidUsed > 0) {
        patch.paidCredits = FieldValue.increment(planned.paidUsed);
    }
    if (planned.savedUsed > 0) {
        patch.savedCredits = FieldValue.increment(planned.savedUsed);
    }

    await userRef.update(patch);
}
