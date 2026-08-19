import { describe, expect, it } from 'vitest';
import {
    getPurchaseCredits,
    getSavedCredits,
    getSpendableCredits,
    getTotalDineCredits,
    computeGiftSavedAmount,
    GIFT_RECIPIENT_VALUE_RATE,
} from './walletCredits.js';

describe('walletCredits — frontend spendable totals', () => {
    const profile = { paidCredits: 50, savedCredits: 100 };

    it('purchase and savings stay separate', () => {
        expect(getPurchaseCredits(profile)).toBe(50);
        expect(getSavedCredits(profile)).toBe(100);
    });

    it('spendable for invites/AI is paid + saved', () => {
        expect(getSpendableCredits(profile)).toBe(150);
        expect(getTotalDineCredits(profile)).toBe(150);
    });

    it('gift UI uses combined spendable balance', () => {
        expect(getPurchaseCredits(profile)).toBe(50);
        expect(getSpendableCredits(profile) >= 90).toBe(true);
        expect(getPurchaseCredits(profile) >= 90).toBe(false);
    });

    it('gift recipient savings rate is 30%', () => {
        expect(GIFT_RECIPIENT_VALUE_RATE).toBe(0.3);
        expect(computeGiftSavedAmount(100)).toBe(30);
        expect(computeGiftSavedAmount(1)).toBe(0);
    });
});
