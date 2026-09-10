/**
 * Pure pricing/quota logic for community offers — no I/O, so it is unit-testable
 * and shared by sendCommunityOffer (the deployed callable uses THIS function, so
 * the tests exercise the real logic).
 *
 * Rule: a business's paid plan includes ONE concurrent offer at no credit cost.
 * Each additional concurrent (active) offer is a prepaid "extra" charged at
 * EXTRA_OFFER_CREDITS_PER_DAY per day of validity, and must carry an expiry
 * (open-ended paid offers are rejected).
 */
const EXTRA_OFFER_CREDITS_PER_DAY = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{ activeCount: number, expiresAtMs: number|null, nowMs?: number }} args
 *   activeCount  — how many active offers the business already has.
 *   expiresAtMs  — chosen expiry in ms, or null for open-ended.
 * @returns {{ isPaid: boolean, days: number, credits: number, error?: 'expiry_required' }}
 *   isPaid — whether this offer is a prepaid extra (vs the free included one).
 *   days/credits — cost for an extra (0 for the included offer).
 *   error — 'expiry_required' when an extra offer has no valid future expiry.
 */
function priceCommunityOffer({ activeCount, expiresAtMs, nowMs = Date.now() }) {
    const isPaid = Number(activeCount) >= 1;
    if (!isPaid) {
        // The included (plan) offer: free, expiry optional.
        return { isPaid: false, days: 0, credits: 0 };
    }
    // Extra offers must have a real future expiry.
    if (expiresAtMs == null || !(Number(expiresAtMs) > nowMs)) {
        return { isPaid: true, days: 0, credits: 0, error: 'expiry_required' };
    }
    const days = Math.max(1, Math.ceil((Number(expiresAtMs) - nowMs) / DAY_MS));
    return { isPaid: true, days, credits: EXTRA_OFFER_CREDITS_PER_DAY * days };
}

module.exports = { priceCommunityOffer, EXTRA_OFFER_CREDITS_PER_DAY, DAY_MS };
