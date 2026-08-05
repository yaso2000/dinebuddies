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
 * Client-side cost hints. Server `publishPrivateInvitationDraft` charges from
 * the purchase wallet (`paidCredits`): social 90, private/personal 185.
 * @param {Record<string, unknown>} inv
 */
export function isPrivateInvitationDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const cat = String(inv.inviteCategory || '').toLowerCase();
    if (cat === 'social') return false;
    if (cat === 'private' || cat === 'dating') return true;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Private' ||
        inv.type === 'Dating' ||
        occasionLc === 'private' ||
        occasionLc === 'dating' ||
        (inv.privateInvitationPreference != null && inv.privateInvitationPreference !== false) ||
        (inv.datingInvitationPreference != null && inv.datingInvitationPreference !== false)
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
