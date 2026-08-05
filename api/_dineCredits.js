import { FieldValue } from 'firebase-admin/firestore';

export function isBusinessUserDoc(d) {
    return (
        d?.isBusiness === true ||
        String(d?.accountType || '').toLowerCase() === 'business' ||
        String(d?.role || '').toLowerCase() === 'business' ||
        String(d?.role || '').toLowerCase() === 'partner'
    );
}

/**
 * Spend from purchase wallet (`paidCredits`) only. Mirrors functions/creditsCore.js.
 * @param {import('firebase-admin/firestore').Transaction} tx
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/firestore').DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 */
export function spendCreditsInTransaction(tx, db, userRef, userData, args) {
    const { uid, accountRole, amount, type, reason, relatedId } = args;
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
        return { freeUsed: 0, paidUsed: 0, balanceType: 'none' };
    }

    let paid = Math.max(0, Math.floor(Number(userData.paidCredits) || 0));
    if (paid < n) {
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }

    paid -= n;

    tx.update(userRef, {
        paidCredits: paid,
        totalCreditsSpent: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: uid,
        accountRole,
        type,
        amount: -n,
        balanceType: 'paid',
        wallet: 'purchase',
        reason: String(reason || '').slice(0, 200),
        relatedId: relatedId ? String(relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
        paidUsed: n,
        freeUsed: 0,
    });

    return { freeUsed: 0, paidUsed: n, balanceType: 'paid' };
}
