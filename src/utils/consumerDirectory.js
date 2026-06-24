import { ADMIN_EMAILS, SUPER_ADMIN_UIDS } from './adminAccess';

/** Team roles — never in member discovery/directory. */
const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent']);

/**
 * Consumer member directory (/search, /search/list) — regular diners only.
 * Legacy public_profiles may omit `searchable` / `accountRole`; we exclude only when explicit.
 */
export function isConsumerDirectoryMember(publicDoc, userDoc = null) {
    const id = publicDoc?.id || publicDoc?.uid;
    if (!id) return false;

    if (SUPER_ADMIN_UIDS.includes(String(id))) return false;

    const email = String(userDoc?.email || publicDoc?.email || '').toLowerCase().trim();
    if (email && ADMIN_EMAILS.includes(email)) return false;

    if (publicDoc?.profileType && publicDoc.profileType !== 'user') return false;
    if (publicDoc?.searchable === false) return false;

    const accountRole = String(publicDoc?.accountRole || '').toLowerCase();
    if (accountRole && TEAM_ROLES.has(accountRole)) return false;

    const role = String(userDoc?.role || accountRole || '').toLowerCase();
    if (TEAM_ROLES.has(role)) return false;
    if (userDoc?.isBusiness === true || role === 'business' || role === 'partner') return false;
    if (publicDoc?.isGuest === true || userDoc?.isGuest === true) return false;

    const displayName =
        String(publicDoc?.displayName || '').trim() ||
        String(userDoc?.display_name || userDoc?.displayName || userDoc?.name || '').trim();
    if (!displayName) return false;

    return true;
}
