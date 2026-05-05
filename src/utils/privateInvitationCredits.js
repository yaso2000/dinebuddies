/**
 * Publish costs for private / dating invitations — must match `functions/creditsCore.js` CREDIT_COSTS.
 * Spending uses the unified Dine Credits wallet (`freeCredits` + `paidCredits`), same as AI.
 * Public invitations (`invitations` collection) = 0 credits (not listed here).
 */
export const PRIVATE_INVITATION_PUBLISH_CREDITS = 90;
export const DATING_INVITATION_PUBLISH_CREDITS = 185;
export const INVITATION_BOOST_CREDITS = 50;

/** Minimum total Dine Credits to start private/dating draft flows (cheapest publish in this flow). */
export const MIN_HOST_INVITATION_DRAFT_CREDITS = PRIVATE_INVITATION_PUBLISH_CREDITS;

/**
 * Client-side cost hints. Server `publishPrivateInvitationDraft` charges **one purchased
 * private invitation credit** per publish (no subscription monthly allowance).
 * @param {Record<string, unknown>} inv
 */
export function isDatingInvitationDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Dating' ||
        occasionLc === 'dating' ||
        (inv.datingInvitationPreference != null && inv.datingInvitationPreference !== false)
    );
}

export function getPrivateInvitationPublishCost(inv) {
    return isDatingInvitationDoc(inv) ? DATING_INVITATION_PUBLISH_CREDITS : PRIVATE_INVITATION_PUBLISH_CREDITS;
}

export function getTotalDineCredits(userProfile) {
    const free = Math.max(0, Number(userProfile?.freeCredits) || 0);
    const paid = Math.max(0, Number(userProfile?.paidCredits) || 0);
    return free + paid;
}

/** @param {Record<string, unknown>|null|undefined} inv */
export function isInvitationBoostActive(inv) {
    const u = inv?.invitationBoostUntil;
    if (!u) return false;
    const ms = typeof u.toMillis === 'function' ? u.toMillis() : typeof u.seconds === 'number' ? u.seconds * 1000 : 0;
    return ms > Date.now();
}
