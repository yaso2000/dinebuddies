import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => {
    const increment = (n) => ({ __op: 'increment', n });
    const serverTimestamp = () => ({ __op: 'serverTimestamp' });
    return {
        FieldValue: { increment, serverTimestamp },
    };
});

import { spendCreditsInTransaction } from './_dineCredits.js';

function makeTx() {
    const updates = [];
    const sets = [];
    const docs = new Map();
    return {
        updates,
        sets,
        update(ref, data) {
            updates.push({ ref, data });
        },
        set(ref, data) {
            sets.push({ ref, data });
        },
        _docs: docs,
    };
}

function makeDb() {
    return {
        collection(name) {
            return {
                doc() {
                    return { path: `${name}/auto`, id: 'auto' };
                },
            };
        },
    };
}

describe('spendCreditsInTransaction ledger + shield safety', () => {
    let tx;
    let db;
    let userRef;
    let userData;

    beforeEach(() => {
        tx = makeTx();
        db = makeDb();
        userRef = { path: 'users/u1' };
        userData = {
            paidCredits: 50,
            savedCredits: 100,
            totalSavedCreditsEarned: 999,
            totalCreditsSpent: 10,
        };
    });

    it('writes ledger with paidUsed/savedUsed and increments totalCreditsSpent by full amount', () => {
        const result = spendCreditsInTransaction(tx, db, userRef, userData, {
            uid: 'u1',
            accountRole: 'user',
            amount: 90,
            type: 'ai_text',
            reason: 'ai_generate_text',
            allowSavedCredits: true,
        });

        expect(result).toMatchObject({ paidUsed: 50, savedUsed: 40, balanceType: 'mixed' });

        const patch = tx.updates[0].data;
        expect(patch.paidCredits).toBe(0);
        expect(patch.savedCredits).toBe(60);
        expect(patch.totalCreditsSpent).toEqual({ __op: 'increment', n: 90 });
        expect(patch).not.toHaveProperty('totalSavedCreditsEarned');

        const ledger = tx.sets[0].data;
        expect(ledger.paidUsed).toBe(50);
        expect(ledger.savedUsed).toBe(40);
        expect(ledger.amount).toBe(-90);
        expect(ledger.wallet).toBe('purchase_and_savings');

        // In-memory shield counter on userData must remain untouched.
        expect(userData.totalSavedCreditsEarned).toBe(999);
    });

    it('gift mode can mix paid then saved like other internal spends', () => {
        const result = spendCreditsInTransaction(tx, db, userRef, userData, {
            uid: 'u1',
            accountRole: 'user',
            amount: 90,
            type: 'profile_gift_send',
            reason: 'profile_gift_send',
            allowSavedCredits: true,
        });
        expect(result.paidUsed).toBe(50);
        expect(result.savedUsed).toBe(40);
        expect(tx.updates[0].data.savedCredits).toBe(60);
        expect(userData.totalSavedCreditsEarned).toBe(999);
    });
});
