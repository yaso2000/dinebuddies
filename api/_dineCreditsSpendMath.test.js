import { describe, expect, it } from 'vitest';
import {
    planCreditSpend,
    planAiCreditRefund,
    SPEND_ALLOWED_USER_FIELDS,
} from './_dineCreditsSpendMath.js';

describe('Vercel spend math mirrors Firebase rules', () => {
    it('mixed deduction for AI / invites', () => {
        const r = planCreditSpend({
            paidCredits: 50,
            savedCredits: 100,
            amount: 90,
            allowSavedCredits: true,
        });
        expect(r).toMatchObject({
            ok: true,
            paidUsed: 50,
            savedUsed: 40,
            paidAfter: 0,
            savedAfter: 60,
            balanceType: 'mixed',
            wallet: 'purchase_and_savings',
        });
    });

    it('AI refund plan restores both wallets and forbids shield mutation', () => {
        const r = planAiCreditRefund({ paidUsed: 50, savedUsed: 40 });
        expect(r.paidUsed + r.savedUsed).toBe(90);
        expect(r.forbiddenFields).toEqual(['totalSavedCreditsEarned']);
        for (const key of r.forbiddenFields) {
            expect(SPEND_ALLOWED_USER_FIELDS.has(key)).toBe(false);
        }
    });
});
