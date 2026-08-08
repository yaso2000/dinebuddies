import { isPrivateInvitationPublished } from './socialInvitationDraft';
import { isPendingInviteForUser } from './inviteLanding';

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
            if (!isPendingInviteForUser(inv, uid)) return false;
            if (!isPrivateInvitationPublished(inv)) return false;
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
        '/create-social',
        '/create-private',
        '/create',
        '/admin',
        '/affiliate',
        '/business/onboarding',
        '/business-signup',
        '/messages',
        '/notifications',
        '/invite/received',
    ];
    if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return true;

    if (path.startsWith('/chat/')) return true;

    if (/^\/invitation\/private\/[^/]+\/preview/.test(path)) return true;
    if (/^\/invitation\/private\/preview\//.test(path)) return true;
    if (/^\/invitation\/private\/[^/]+$/.test(path)) return true;
    if (/^\/invite\/p\//.test(path)) return true;

    return false;
}

/** True while user is browsing messages or the notifications inbox. */
export function isMessagingOrNotificationsRoute(pathname = '') {
    const path = String(pathname || '');
    return path === '/messages' || path === '/notifications' || path.startsWith('/chat/');
}
