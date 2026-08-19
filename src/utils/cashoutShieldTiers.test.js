import { describe, expect, it } from 'vitest';
import {
    CASHOUT_SHIELD_TIERS,
    CASHOUT_MINIMUM_CREDITS,
    getCashoutShieldTier,
    canCashoutShield,
    computeJarBreakdown,
} from './cashoutShieldTiers.js';

describe('cashoutShieldTiers', () => {
    it('defines fixed jar packages only (no free-form amounts)', () => {
        expect(CASHOUT_SHIELD_TIERS.map((t) => t.id)).toEqual([
            'bronze',
            'silver',
            'gold',
            'platinum',
            'diamond',
        ]);
        expect(CASHOUT_MINIMUM_CREDITS).toBe(625);
        expect(getCashoutShieldTier('bronze')).toMatchObject({
            amountCredits: 625,
            amountFiatUsd: 6.25,
        });
        expect(getCashoutShieldTier('Silver')).toMatchObject({
            amountCredits: 1250,
            amountFiatUsd: 12.5,
        });
        expect(getCashoutShieldTier('gold')).toMatchObject({
            amountCredits: 2500,
            amountFiatUsd: 25,
        });
        expect(getCashoutShieldTier('platinum').amountCredits).toBe(5000);
        expect(getCashoutShieldTier('diamond').amountCredits).toBe(10000);
        expect(getCashoutShieldTier('copper')).toBeNull();
        expect(getCashoutShieldTier(5000)).toBeNull();
    });

    it('each tier is exactly double the one before it, topping out at $100', () => {
        for (let i = 1; i < CASHOUT_SHIELD_TIERS.length; i += 1) {
            expect(CASHOUT_SHIELD_TIERS[i].amountCredits).toBe(
                CASHOUT_SHIELD_TIERS[i - 1].amountCredits * 2
            );
        }
        expect(CASHOUT_SHIELD_TIERS.at(-1).amountFiatUsd).toBe(100);
    });

    it('enables packages only when current savings cover exact cost', () => {
        expect(canCashoutShield(625, 'bronze')).toBe(true);
        expect(canCashoutShield(624, 'bronze')).toBe(false);
        expect(canCashoutShield(1250, 'silver')).toBe(true);
        expect(canCashoutShield(1249, 'silver')).toBe(false);
        expect(canCashoutShield(10000, 'diamond')).toBe(true);
        expect(canCashoutShield(9999, 'diamond')).toBe(false);
    });

    it('breaks a balance into the fewest jars, largest first (2 small = 1 medium)', () => {
        expect(computeJarBreakdown(1250)).toEqual({
            items: [{ id: 'silver', count: 1, tier: getCashoutShieldTier('silver') }],
            looseCredits: 0,
        });
        expect(computeJarBreakdown(1875)).toEqual({
            items: [
                { id: 'silver', count: 1, tier: getCashoutShieldTier('silver') },
                { id: 'bronze', count: 1, tier: getCashoutShieldTier('bronze') },
            ],
            looseCredits: 0,
        });
        expect(computeJarBreakdown(19999)).toEqual({
            items: [
                { id: 'diamond', count: 1, tier: getCashoutShieldTier('diamond') },
                { id: 'platinum', count: 1, tier: getCashoutShieldTier('platinum') },
                { id: 'gold', count: 1, tier: getCashoutShieldTier('gold') },
                { id: 'silver', count: 1, tier: getCashoutShieldTier('silver') },
                { id: 'bronze', count: 1, tier: getCashoutShieldTier('bronze') },
            ],
            looseCredits: 624,
        });
        expect(computeJarBreakdown(300)).toEqual({ items: [], looseCredits: 300 });
        expect(computeJarBreakdown(0)).toEqual({ items: [], looseCredits: 0 });
    });
});
