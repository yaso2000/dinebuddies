/**
 * Draft vs published helpers for `private_invitations` documents.
 * Published docs set `status: 'published'` and `publishedAt`; legacy rows may omit `status`.
 */
import { resolveInviteCategory } from './inviteCategory';

/** @param {object} [inv] */
export function isHostedInvitationPublished(inv) {
    if (!inv) return false;
    if (inv.publishedAt) return true;
    return inv.status === 'published';
}

/** @deprecated */
export const isPrivateInvitationPublished = isHostedInvitationPublished;

/** @param {object} [inv] */
export function isHostedInvitationDraft(inv) {
    if (!inv) return false;
    if (isHostedInvitationPublished(inv)) return false;
    return inv.status === 'draft' || inv.status == null || inv.status === '';
}

/** @deprecated */
export const isPrivateInvitationDraft = isHostedInvitationDraft;

/** @param {object} [inv] */
export function isPrivateHostedInvitation(inv) {
    return resolveInviteCategory(inv) === 'private';
}

/** @deprecated — use isPrivateHostedInvitation */
export const isDatingPrivateInvitation = isPrivateHostedInvitation;

/** @param {object} [inv] */
export function getInvitationCreatePath(inv) {
    return resolveInviteCategory(inv) === 'private' ? '/create-private' : '/create-social';
}

/** @deprecated */
export const getPrivateInvitationCreatePath = getInvitationCreatePath;

/** @param {object} [inv] */
export function getInvitationDetailsPath(inv) {
    const id = inv?.id;
    if (!id) return getInvitationCreatePath(inv);
    const segment = resolveInviteCategory(inv) === 'private' ? 'private' : 'social';
    return isHostedInvitationDraft(inv)
        ? `/invitation/${segment}/preview/${id}`
        : `/invitation/${segment}/${id}`;
}

/** @deprecated */
export const getSocialInvitationDetailsPath = getInvitationDetailsPath;
/** @deprecated */
export const getPrivateInvitationDetailsPath = getInvitationDetailsPath;

const DRAFT_KIND_STORAGE_KEY = 'dineb_last_hosted_draft_kind';

/** Remember whether the last draft flow was private or social (preview recovery). */
export function rememberHostedDraftCreateKind(invOrKind) {
    if (typeof window === 'undefined') return;
    let kind = 'social';
    if (invOrKind === 'private' || invOrKind === 'social') {
        kind = invOrKind;
    } else {
        kind = resolveInviteCategory(invOrKind) === 'private' ? 'private' : 'social';
    }
    try {
        sessionStorage.setItem(DRAFT_KIND_STORAGE_KEY, kind);
    } catch {
        /* ignore */
    }
}

/** @deprecated */
export const rememberPrivateDraftCreateKind = rememberHostedDraftCreateKind;

/** @returns {'private' | 'social'} */
export function readHostedDraftCreateKind() {
    if (typeof window === 'undefined') return 'social';
    try {
        const v = sessionStorage.getItem(DRAFT_KIND_STORAGE_KEY);
        if (v === 'private' || v === 'dating') return 'private';
        if (v === 'social') return 'social';
        return v === 'private' ? 'private' : 'social';
    } catch {
        return 'social';
    }
}

/** @deprecated */
export const readPrivateDraftCreateKind = readHostedDraftCreateKind;

export function getHostedDraftRecoveryCreatePath() {
    return readHostedDraftCreateKind() === 'private' ? '/create-private' : '/create-social';
}

/** @deprecated */
export const getPrivateDraftRecoveryCreatePath = getHostedDraftRecoveryCreatePath;
