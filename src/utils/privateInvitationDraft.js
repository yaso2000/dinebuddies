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
export function isDatingPrivateInvitation(inv) {
    if (!inv) return false;
    if (inv.type === 'Dating') return true;
    const occ = String(inv.occasionType || '').toLowerCase();
    return occ === 'dating';
}

/** @param {object} [inv] */
export function getPrivateInvitationCreatePath(inv) {
    return isDatingPrivateInvitation(inv) ? '/create-dating' : '/create-private';
}

/** @param {object} [inv] */
export function getPrivateInvitationDetailsPath(inv) {
    const id = inv?.id;
    if (!id) return getPrivateInvitationCreatePath(inv);
    return isPrivateInvitationDraft(inv)
        ? `/invitation/private/preview/${id}`
        : `/invitation/private/${id}`;
}

const DRAFT_KIND_STORAGE_KEY = 'dineb_last_private_draft_kind';

/** Remember whether the last draft flow was dating or private (preview recovery). */
export function rememberPrivateDraftCreateKind(invOrKind) {
    if (typeof window === 'undefined') return;
    const kind =
        invOrKind === 'dating' || invOrKind === 'private'
            ? invOrKind
            : isDatingPrivateInvitation(invOrKind)
              ? 'dating'
              : 'private';
    try {
        sessionStorage.setItem(DRAFT_KIND_STORAGE_KEY, kind);
    } catch {
        /* ignore */
    }
}

/** @returns {'dating' | 'private'} */
export function readPrivateDraftCreateKind() {
    if (typeof window === 'undefined') return 'private';
    try {
        return sessionStorage.getItem(DRAFT_KIND_STORAGE_KEY) === 'dating' ? 'dating' : 'private';
    } catch {
        return 'private';
    }
}

export function getPrivateDraftRecoveryCreatePath() {
    return readPrivateDraftCreateKind() === 'dating' ? '/create-dating' : '/create-private';
}
