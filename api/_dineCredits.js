import { FieldValue } from 'firebase-admin/firestore';
import { planCreditSpend } from './_dineCreditsSpendMath.js';

export function isBusinessUserDoc(d) {
    return (
        d?.isBusiness === true ||
        String(d?.accountType || '').toLowerCase() === 'business' ||
        String(d?.role || '').toLowerCase() === 'business' ||
        String(d?.role || '').toLowerCase() === 'partner'
    );
}

/**
 * Spend credits: purchase wallet first, then savings (when allowSavedCredits).
 * Mirrors functions/creditsCore.js.
 * @param {import('firebase-admin/firestore').Transaction} tx
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/firestore').DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 */
export function spendCreditsInTransaction(tx, db, userRef, userData, args) {
    const { uid, accountRole, amount, type, reason, relatedId } = args;
    const planned = planCreditSpend({
        paidCredits: userData.paidCredits,
        savedCredits: userData.savedCredits,
        amount,
        allowSavedCredits: args.allowSavedCredits,
    });

    if (!planned.ok) {
        if (planned.code === 'INVALID_AMOUNT') {
            return { freeUsed: 0, paidUsed: 0, savedUsed: 0, balanceType: 'none' };
        }
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }

    const { amount: n, paidUsed, savedUsed, paidAfter, savedAfter, balanceType, wallet } = planned;

    /** @type {Record<string, unknown>} */
    const patch = {
        paidCredits: paidAfter,
        // STRICT: never touch totalSavedCreditsEarned (Shield progress).
        totalCreditsSpent: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (savedUsed > 0) {
        patch.savedCredits = savedAfter;
    }
    tx.update(userRef, patch);

    userData.paidCredits = paidAfter;
    if (savedUsed > 0) {
        userData.savedCredits = savedAfter;
    }

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: uid,
        accountRole,
        type,
        amount: -n,
        balanceType,
        wallet,
        reason: String(reason || '').slice(0, 200),
        relatedId: relatedId ? String(relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
        paidUsed,
        savedUsed,
        freeUsed: 0,
    });

    return { freeUsed: 0, paidUsed, savedUsed, balanceType };
}
