import { describe, expect, it } from 'vitest';
import {
    CASHOUT_SHIELD_TIERS,
    CASHOUT_MINIMUM_CREDITS,
    getCashoutShieldTier,
    canCashoutShield,
} from './cashoutShieldTiers.js';

describe('cashoutShieldTiers', () => {
    it('defines fixed shield packages only (no free-form amounts)', () => {
        expect(CASHOUT_SHIELD_TIERS.map((t) => t.id)).toEqual([
            'silver',
            'gold',
            'platinum',
            'diamond',
        ]);
        expect(CASHOUT_MINIMUM_CREDITS).toBe(4000);
        expect(getCashoutShieldTier('Silver')).toMatchObject({
            amountCredits: 4000,
            amountFiatUsd: 40,
        });
        expect(getCashoutShieldTier('gold')).toMatchObject({
            amountCredits: 6000,
            amountFiatUsd: 60,
        });
        expect(getCashoutShieldTier('platinum').amountCredits).toBe(8000);
        expect(getCashoutShieldTier('diamond').amountCredits).toBe(10000);
        expect(getCashoutShieldTier('bronze')).toBeNull();
        expect(getCashoutShieldTier(5000)).toBeNull();
    });

    it('enables packages only when current savings cover exact cost', () => {
        expect(canCashoutShield(5000, 'silver')).toBe(true);
        expect(canCashoutShield(5000, 'gold')).toBe(false);
        expect(canCashoutShield(10000, 'diamond')).toBe(true);
        expect(canCashoutShield(9999, 'diamond')).toBe(false);
    });
});
