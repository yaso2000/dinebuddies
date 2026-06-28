/**
 * Publish costs for private / private invites — must match `functions/creditsCore.js` CREDIT_COSTS.
 * Spending uses the purchase wallet (`paidCredits`) only.
 * Public invitations (`invitations` collection) = 0 credits (not listed here).
 */
export { getTotalDineCredits, getPurchaseCredits } from './walletCredits';

export const SOCIAL_INVITATION_PUBLISH_CREDITS = 90;
export const PRIVATE_INVITATION_PUBLISH_CREDITS = 185;
export const INVITATION_BOOST_CREDITS = 50;

/** Minimum total Dine Credits to start private/dating draft flows (cheapest publish in this flow). */
export const MIN_HOST_INVITATION_DRAFT_CREDITS = SOCIAL_INVITATION_PUBLISH_CREDITS;

/**
 * Client-side cost hints. Server `publishPrivateInvitationDraft` charges **one purchased
 * private invitation credit** per publish (no subscription monthly allowance).
 * @param {Record<string, unknown>} inv
 */
export function isPrivateInvitationDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Private' ||
        occasionLc === 'private' ||
        (inv.privateInvitationPreference != null && inv.privateInvitationPreference !== false)
    );
}

export function getPrivateInvitationPublishCost(inv) {
    return isPrivateInvitationDoc(inv) ? PRIVATE_INVITATION_PUBLISH_CREDITS : SOCIAL_INVITATION_PUBLISH_CREDITS;
}

/** @param {Record<string, unknown>|null|undefined} inv */
export function isInvitationBoostActive(inv) {
    const u = inv?.invitationBoostUntil;
    if (!u) return false;
    const ms = typeof u.toMillis === 'function' ? u.toMillis() : typeof u.seconds === 'number' ? u.seconds * 1000 : 0;
    return ms > Date.now();
}
