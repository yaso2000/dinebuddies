import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    planCreditSpend,
    planAiCreditRefund,
    SPEND_ALLOWED_USER_FIELDS,
} = require('./creditsSpendMath.js');

describe('planCreditSpend — two-wallet deduction math', () => {
    it('deducts from paidCredits only when enough purchase balance', () => {
        const r = planCreditSpend({
            paidCredits: 200,
            savedCredits: 100,
            amount: 90,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed).toBe(90);
        expect(r.savedUsed).toBe(0);
        expect(r.paidAfter).toBe(110);
        expect(r.savedAfter).toBe(100);
        expect(r.balanceType).toBe('paid');
        expect(r.wallet).toBe('purchase');
        expect(r.amount).toBe(90);
    });

    it('uses paid first then savings for the remainder (mixed)', () => {
        const r = planCreditSpend({
            paidCredits: 50,
            savedCredits: 100,
            amount: 90,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed).toBe(50);
        expect(r.savedUsed).toBe(40);
        expect(r.paidAfter).toBe(0);
        expect(r.savedAfter).toBe(60);
        expect(r.balanceType).toBe('mixed');
        expect(r.wallet).toBe('purchase_and_savings');
    });

    it('can spend from savings only when purchase is empty', () => {
        const r = planCreditSpend({
            paidCredits: 0,
            savedCredits: 185,
            amount: 185,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed).toBe(0);
        expect(r.savedUsed).toBe(185);
        expect(r.balanceType).toBe('saved');
        expect(r.wallet).toBe('savings');
    });

    it('defaults allowSavedCredits to true', () => {
        const r = planCreditSpend({
            paidCredits: 10,
            savedCredits: 100,
            amount: 50,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed).toBe(10);
        expect(r.savedUsed).toBe(40);
    });

    it('allowSavedCredits false rejects when paid is insufficient', () => {
        const r = planCreditSpend({
            paidCredits: 20,
            savedCredits: 500,
            amount: 50,
            allowSavedCredits: false,
        });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('allowSavedCredits false spends paid only', () => {
        const r = planCreditSpend({
            paidCredits: 80,
            savedCredits: 500,
            amount: 50,
            allowSavedCredits: false,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed).toBe(50);
        expect(r.savedUsed).toBe(0);
        expect(r.savedAfter).toBe(500);
    });

    it('gifts path: allowSavedCredits true mixes paid then saved', () => {
        const r = planCreditSpend({
            paidCredits: 20,
            savedCredits: 500,
            amount: 50,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed).toBe(20);
        expect(r.savedUsed).toBe(30);
    });

    it('rejects when combined balance is insufficient', () => {
        const r = planCreditSpend({
            paidCredits: 10,
            savedCredits: 10,
            amount: 90,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('floors fractional amounts and balances', () => {
        const r = planCreditSpend({
            paidCredits: 10.9,
            savedCredits: 5.9,
            amount: 12.7,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(true);
        expect(r.amount).toBe(12);
        expect(r.paidUsed).toBe(10);
        expect(r.savedUsed).toBe(2);
    });
});

describe('planAiCreditRefund — failsafe integrity', () => {
    it('refunds exact paidUsed and savedUsed breakdown', () => {
        const r = planAiCreditRefund({ paidUsed: 50, savedUsed: 40, freeUsed: 0 });
        expect(r.shouldRefund).toBe(true);
        expect(r.paidUsed).toBe(50);
        expect(r.savedUsed).toBe(40);
        expect(r.forbiddenFields).toContain('totalSavedCreditsEarned');
    });

    it('no-ops when nothing was charged', () => {
        expect(planAiCreditRefund(null).shouldRefund).toBe(false);
        expect(planAiCreditRefund({ paidUsed: 0, savedUsed: 0 }).shouldRefund).toBe(false);
    });

    it('handles paid-only and saved-only charges', () => {
        expect(planAiCreditRefund({ paidUsed: 10, savedUsed: 0 })).toMatchObject({
            paidUsed: 10,
            savedUsed: 0,
            shouldRefund: true,
        });
        expect(planAiCreditRefund({ paidUsed: 0, savedUsed: 5 })).toMatchObject({
            paidUsed: 0,
            savedUsed: 5,
            shouldRefund: true,
        });
    });
});

describe('spend patch field constraints', () => {
    it('never allows totalSavedCreditsEarned on spend patches', () => {
        expect(SPEND_ALLOWED_USER_FIELDS.has('totalSavedCreditsEarned')).toBe(false);
        expect(SPEND_ALLOWED_USER_FIELDS.has('paidCredits')).toBe(true);
        expect(SPEND_ALLOWED_USER_FIELDS.has('savedCredits')).toBe(true);
        expect(SPEND_ALLOWED_USER_FIELDS.has('totalCreditsSpent')).toBe(true);
    });

    it('ledger breakdown equals total amount', () => {
        const r = planCreditSpend({
            paidCredits: 30,
            savedCredits: 70,
            amount: 90,
            allowSavedCredits: true,
        });
        expect(r.ok).toBe(true);
        expect(r.paidUsed + r.savedUsed).toBe(r.amount);
    });
});
