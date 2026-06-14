import { sanitizeNextPath } from './safeInternalPath';

const PENDING_SHARE_TOKEN_KEY = 'dinebuddies_pending_private_invite_token';

/** @param {string} token */
export function buildPrivateInvitationSharePath(token) {
    const t = String(token || '').trim();
    if (!t) return null;
    return `/invite/p/${encodeURIComponent(t)}`;
}

/** @param {string} token */
export function buildPrivateInvitationShareUrl(token) {
    const path = buildPrivateInvitationSharePath(token);
    if (!path || typeof window === 'undefined') return path || '';
    return `${window.location.origin}${path}`;
}

/**
 * @param {{ title?: string; description?: string; date?: string; time?: string; location?: string; inviterName?: string }} invitation
 * @param {string} shareUrl
 * @param {(key: string, fallback?: string) => string} t
 */
export function buildPrivateInvitationShareMessage(invitation, shareUrl, t) {
    const title = String(invitation?.title || '').trim();
    const inviter = String(invitation?.inviterName || '').trim();
    const date = invitation?.date ? String(invitation.date) : '';
    const time = invitation?.time ? String(invitation.time) : '';
    const location = String(invitation?.location || '').trim();
    const description = String(invitation?.description || '').trim();

    const headline = inviter
        ? t('private_share_message_with_host', {
              defaultValue: '{{host}} invited you on DineBuddies',
              host: inviter,
          })
        : t('private_share_message_generic', { defaultValue: 'You have a private invitation on DineBuddies' });

    const parts = [headline];
    if (title) parts.push(title);
    if (date || time) {
        parts.push([date, time].filter(Boolean).join(' · '));
    }
    if (location) parts.push(location);
    if (description) parts.push(description.slice(0, 160));
    parts.push(
        t('private_share_cta_line', {
            defaultValue: 'Open the link to sign up and respond:',
        })
    );
    if (shareUrl) parts.push(shareUrl);
    return parts.filter(Boolean).join('\n');
}

/** @param {string} token */
export function stashPendingPrivateInviteToken(token) {
    if (!token || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(PENDING_SHARE_TOKEN_KEY, token);
    } catch {
        /* ignore */
    }
}

export function consumePendingPrivateInviteToken() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const token = sessionStorage.getItem(PENDING_SHARE_TOKEN_KEY);
        if (token) sessionStorage.removeItem(PENDING_SHARE_TOKEN_KEY);
        return token || null;
    } catch {
        return null;
    }
}

/** @param {string | null | undefined} returnPath */
export function buildLoginUrlWithNext(returnPath) {
    const path = sanitizeNextPath(returnPath);
    if (!path) return '/login';
    return `/login?next=${encodeURIComponent(path)}`;
}
