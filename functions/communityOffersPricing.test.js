import { describe, expect, it } from 'vitest';
import { priceCommunityOffer, EXTRA_OFFER_CREDITS_PER_DAY } from './communityOffersPricing.js';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0); // fixed clock so tests are deterministic
const inDays = (n) => NOW + n * 24 * 60 * 60 * 1000;
const inHours = (n) => NOW + n * 60 * 60 * 1000;

describe('priceCommunityOffer — included vs prepaid extra', () => {
    it('rate constant is 150 credits/day', () => {
        expect(EXTRA_OFFER_CREDITS_PER_DAY).toBe(150);
    });

    it('first active offer is the free included one (open-ended allowed)', () => {
        expect(priceCommunityOffer({ activeCount: 0, expiresAtMs: null, nowMs: NOW })).toEqual({
            isPaid: false,
            days: 0,
            credits: 0,
        });
    });

    it('included offer stays free even with an expiry date', () => {
        expect(priceCommunityOffer({ activeCount: 0, expiresAtMs: inDays(30), nowMs: NOW })).toEqual({
            isPaid: false,
            days: 0,
            credits: 0,
        });
    });

    it('second concurrent offer is a prepaid extra: 150 x days', () => {
        expect(priceCommunityOffer({ activeCount: 1, expiresAtMs: inDays(3), nowMs: NOW })).toEqual({
            isPaid: true,
            days: 3,
            credits: 450,
        });
    });

    it('prices by how many are already active (third offer still 150/day)', () => {
        expect(priceCommunityOffer({ activeCount: 2, expiresAtMs: inDays(1), nowMs: NOW })).toEqual({
            isPaid: true,
            days: 1,
            credits: 150,
        });
    });

    it('partial days round UP (25h => 2 days)', () => {
        expect(priceCommunityOffer({ activeCount: 1, expiresAtMs: inHours(25), nowMs: NOW })).toEqual({
            isPaid: true,
            days: 2,
            credits: 300,
        });
    });

    it('an expiry under a day still bills a minimum of 1 day', () => {
        expect(priceCommunityOffer({ activeCount: 1, expiresAtMs: inHours(1), nowMs: NOW })).toEqual({
            isPaid: true,
            days: 1,
            credits: 150,
        });
    });

    it('extra offer with NO expiry is rejected (open-ended not allowed)', () => {
        const r = priceCommunityOffer({ activeCount: 1, expiresAtMs: null, nowMs: NOW });
        expect(r.isPaid).toBe(true);
        expect(r.error).toBe('expiry_required');
        expect(r.credits).toBe(0);
    });

    it('extra offer with a past expiry is rejected', () => {
        const r = priceCommunityOffer({ activeCount: 1, expiresAtMs: inDays(-1), nowMs: NOW });
        expect(r.error).toBe('expiry_required');
    });
});
