/**
 * After publishPrivateInvitationDraft sets publishedAt, invitee expansion must not
 * happen on the client — the publish callable short-circuits and will not re-filter
 * or re-charge credits.
 */

export function isPrivateInvitationPublished(invitation) {
    return invitation != null && invitation.publishedAt != null && invitation.publishedAt !== '';
}

/** Keep only invitees that were already on the published document. */
export function filterInviteesForPublishedEdit(originalInvitees, nextInvitees) {
    const allowed = new Set(Array.isArray(originalInvitees) ? originalInvitees : []);
    return (Array.isArray(nextInvitees) ? nextInvitees : []).filter((id) => allowed.has(id));
}

/** True when nextInvitees does not introduce any uid absent from the published set. */
export function hasOnlyPublishedInvitees(originalInvitees, nextInvitees) {
    const allowed = new Set(Array.isArray(originalInvitees) ? originalInvitees : []);
    return (Array.isArray(nextInvitees) ? nextInvitees : []).every((id) => allowed.has(id));
}
