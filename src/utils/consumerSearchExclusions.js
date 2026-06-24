import { ADMIN_EMAILS, SUPER_ADMIN_UIDS } from './adminAccess';
import { isConsumerDirectoryMember } from './consumerDirectory';

/** Roles that must never appear in consumer-facing user/business search. */
const EXCLUDED_CONSUMER_SEARCH_ROLES = new Set([
    'admin',
    'staff',
    'support',
    'moderator',
    'affiliate_agent',
]);

export function isExcludedConsumerSearchRole(role) {
    return EXCLUDED_CONSUMER_SEARCH_ROLES.has(String(role || '').toLowerCase());
}

function isConsumerHiddenUid(uid) {
    const id = String(uid || '').trim();
    return id.length > 0 && SUPER_ADMIN_UIDS.includes(id);
}

function isConsumerHiddenEmail(email) {
    const normalized = String(email || '').toLowerCase().trim();
    return normalized.length > 0 && ADMIN_EMAILS.includes(normalized);
}

/**
 * True when this account must be invisible to regular consumer users
 * (search, followers, public profile pages).
 */
export function isHiddenFromConsumerApp(data = {}) {
    const id = data.id || data.uid;
    if (isConsumerHiddenUid(id)) return true;
    if (data.isGuest === true) return true;
    if (data.searchable === false) return true;
    if (isConsumerHiddenEmail(data.email)) return true;

    const role = String(data.role || data.accountRole || '').toLowerCase();
    if (isExcludedConsumerSearchRole(role)) return true;

    return false;
}

/** `public_profiles` projection document. */
export function isExcludedFromPublicProfileSearch(data) {
    return !isConsumerDirectoryMember(data);
}

/** Full `users/{uid}` document (direct lookup fallback). */
export function isExcludedFromUserDocSearch(data) {
    if (!data || data.isGuest === true) return true;
    const role = String(data.role || '').toLowerCase();
    if (role === 'business' || role === 'partner' || data.isBusiness === true) return false;
    return isHiddenFromConsumerApp(data);
}

/** Mapped directory / network row. */
export function isExcludedDirectoryUser(user) {
    return !isConsumerDirectoryMember(
        {
            id: user?.id,
            profileType: user?.profileType || 'user',
            displayName: user?.displayName || user?.display_name || user?.name,
            accountRole: user?.accountRole || user?.role,
            searchable: user?.searchable !== false,
        },
        user
    );
}
