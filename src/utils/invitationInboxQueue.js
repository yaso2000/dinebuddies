import { isPrivateInvitationPublished } from './privateInvitationDraft';

/** @param {unknown} v */
export function normInvitationUid(v) {
    if (v == null || v === '') return '';
    return typeof v === 'string' ? v : String(v);
}

/**
 * Pending invitee inbox: published, not host, RSVP pending, not session-dismissed.
 * Sorted oldest first (publishedAt, then createdAt).
 *
 * @param {object[]} invitations
 * @param {string} viewerUid
 * @param {Set<string>} closedIds
 */
export function buildPendingInvitationInboxQueue(invitations, viewerUid, closedIds) {
    const uid = normInvitationUid(viewerUid);
    if (!uid || !Array.isArray(invitations)) return [];

    const ts = (inv) =>
        inv?.publishedAt?.seconds ??
        inv?.publishedAt?.toDate?.()?.getTime?.() / 1000 ??
        inv?.createdAt?.seconds ??
        inv?.createdAt?.toDate?.()?.getTime?.() / 1000 ??
        0;

    return invitations
        .filter((inv) => {
            if (!inv?.id) return false;
            if (!isPrivateInvitationPublished(inv)) return false;

            const hostId = normInvitationUid(inv.authorId || inv.author?.id);
            if (hostId && hostId === uid) return false;

            const invited = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
            const isInvitee = invited.some((f) => normInvitationUid(f) === uid);
            if (!isInvitee) return false;

            const rsvp =
                inv.rsvps?.[uid] ??
                inv.rsvps?.[viewerUid];
            if (rsvp && rsvp !== 'pending') return false;

            if (closedIds?.has(inv.id)) return false;

            return true;
        })
        .sort((a, b) => ts(a) - ts(b));
}

/** Routes where the fullscreen inbox should not cover the UI. */
export function shouldSuppressInvitationInbox(pathname = '') {
    const path = String(pathname || '');
    if (!path) return false;

    const prefixes = [
        '/login',
        '/verify-email',
        '/complete-profile',
        '/auth',
        '/create-private',
        '/create-dating',
        '/create',
        '/admin',
        '/affiliate',
        '/business/onboarding',
        '/business-signup'
    ];
    if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return true;

    if (/^\/invitation\/private\/[^/]+\/preview/.test(path)) return true;
    if (/^\/invitation\/private\/preview\//.test(path)) return true;
    if (/^\/invitation\/private\/[^/]+$/.test(path)) return true;

    return false;
}
