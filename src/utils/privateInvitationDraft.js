/**
 * Draft vs published helpers for `private_invitations` documents.
 * Published docs set `status: 'published'` and `publishedAt`; legacy rows may omit `status`.
 */

/** @param {object} [inv] */
export function isPrivateInvitationPublished(inv) {
    if (!inv) return false;
    if (inv.publishedAt) return true;
    return inv.status === 'published';
}

/** @param {object} [inv] */
export function isPrivateInvitationDraft(inv) {
    if (!inv) return false;
    if (isPrivateInvitationPublished(inv)) return false;
    return inv.status === 'draft' || inv.status == null || inv.status === '';
}

/** @param {object} [inv] */
export function getPrivateInvitationDetailsPath(inv) {
    const id = inv?.id;
    if (!id) return '/create-private';
    return isPrivateInvitationDraft(inv)
        ? `/invitation/private/preview/${id}`
        : `/invitation/private/${id}`;
}
