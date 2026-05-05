/** Default matches `DEFAULT_COST` in `api/generate-image.js` when env is unset. */
const FALLBACK_CREDITS = 5;

/**
 * Credits shown in the UI before calling `/api/generate-image`.
 * Set `VITE_INVITATION_AI_IMAGE_CREDIT_COST` to match server `INVITATION_AI_IMAGE_CREDIT_COST`.
 * @returns {number}
 */
export function getAdvertisedInvitationAiCoverCreditCost() {
    const raw = import.meta.env.VITE_INVITATION_AI_IMAGE_CREDIT_COST;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return FALLBACK_CREDITS;
    }
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return FALLBACK_CREDITS;
    return n;
}
