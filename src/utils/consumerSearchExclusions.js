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

/** `public_profiles` projection document. */
export function isExcludedFromPublicProfileSearch(data) {
    if (!data || data.isGuest === true) return true;
    if (data.searchable === false) return true;
    return isExcludedConsumerSearchRole(data.accountRole);
}

/** Full `users/{uid}` document (direct lookup fallback). */
export function isExcludedFromUserDocSearch(data) {
    if (!data || data.isGuest === true) return true;
    const role = String(data.role || '').toLowerCase();
    if (role === 'business' || role === 'partner' || data.isBusiness === true) return false;
    return isExcludedConsumerSearchRole(role);
}
