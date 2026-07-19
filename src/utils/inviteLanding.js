export function uidStr(v) {
    if (v == null || v === '') return '';
    return String(v);
}

/** Published private/dating invite still awaiting this user's RSVP. */
export function isPendingInviteForUser(inv, uid) {
    const me = uidStr(uid);
    if (!me || !inv?.id) return false;
    if (inv.status === 'draft') return false;

    const hostId = uidStr(inv.authorId || inv.author?.id);
    if (hostId && hostId === me) return false;

    const invited = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
    if (!invited.some((f) => uidStr(f) === me)) return false;

    const rsvp = inv.rsvps?.[me];
    if (rsvp != null && rsvp !== '' && String(rsvp).toLowerCase() !== 'pending') return false;

    return true;
}

/**
 * Host or invitee may open hosted invite details (including after accept/decline).
 * Used by notification panel links — do not require pending RSVP.
 */
export function canViewerOpenHostedInvitation(inv, uid) {
    const me = uidStr(uid);
    if (!me || !inv?.id) return false;

    const hostId = uidStr(inv.authorId || inv.author?.id);
    if (hostId && hostId === me) return true;

    const invited = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
    if (!invited.some((f) => uidStr(f) === me)) return false;

    // Invitees only see published invites (drafts stay host-only).
    if (inv.status === 'draft' && !inv.publishedAt) return false;
    return true;
}

export function sortInvitesOldestFirst(a, b) {
    const ts = (inv) =>
        inv?.publishedAt?.seconds ??
        inv?.publishedAt?.toDate?.()?.getTime?.() / 1000 ??
        inv?.createdAt?.seconds ??
        0;
    return ts(a) - ts(b);
}

/** Only these routes count as "opening the app" for the pending-invite landing gate. */
export function isInviteLandingEntryRoute(pathname = '') {
    const path = String(pathname || '');
    return path === '/' || path === '/posts-feed';
}

const INVITE_LANDING_EXEMPT_PREFIXES = [
    '/login',
    '/verify-email',
    '/complete-profile',
    '/auth',
    '/invite/received',
    '/create-social',
    '/create-private',
    '/create',
    '/business/signup',
    '/business/onboarding',
    '/admin',
    '/affiliate',
];

function isInviteLandingExemptRoute(pathname = '') {
    const path = String(pathname || '');
    if (!path) return true;
    if (isInviteLandingEntryRoute(path)) return true;
    if (INVITE_LANDING_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return true;
    }
    if (/^\/invitation\/private\//.test(path)) return true;
    if (/^\/invite\/p\//.test(path)) return true;
    return false;
}

/**
 * User opened messages, chat, profile, etc. — do not show invite cards later this session.
 */
export function shouldDisqualifyInviteLandingForSession(pathname = '') {
    return !isInviteLandingExemptRoute(pathname);
}

/** @deprecated Use shouldDisqualifyInviteLandingForSession */
export function shouldHideInviteLanding(pathname = '') {
    return shouldDisqualifyInviteLandingForSession(pathname);
}
