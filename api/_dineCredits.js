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
 * Spend Dine Credits (free pool first, then paid). Mirrors functions/creditsCore.js.
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

    let free = Math.max(0, Math.floor(Number(userData.freeCredits) || 0));
    let paid = Math.max(0, Math.floor(Number(userData.paidCredits) || 0));
    const total = free + paid;
    if (total < n) {
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }

    const fromFree = Math.min(free, n);
    const fromPaid = n - fromFree;
    free -= fromFree;
    paid -= fromPaid;

    const balanceType = fromFree > 0 && fromPaid > 0 ? 'mixed' : fromFree > 0 ? 'free' : 'paid';

    tx.update(userRef, {
        freeCredits: free,
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
        balanceType,
        reason: String(reason || '').slice(0, 200),
        relatedId: relatedId ? String(relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
        freeUsed: fromFree,
        paidUsed: fromPaid,
    });

    return { freeUsed: fromFree, paidUsed: fromPaid, balanceType };
}
