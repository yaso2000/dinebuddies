import { ADMIN_EMAILS, SUPER_ADMIN_UIDS } from './adminAccess';

/** Team roles — never in member discovery/directory. `regional_manager` is staff too. */
const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent', 'regional_manager']);

/** Durable admin/staff markers independent of the `role` field. */
function hasAdminStaffFlag(doc) {
    if (!doc) return false;
    if (doc.isAdmin === true || doc.isStaff === true || doc.isTeamMember === true) return true;
    if (String(doc.accountType || '').toLowerCase() === 'admin') return true;
    return false;
}

/**
 * Consumer member directory (/search, /search/list) — regular diners only.
 * Legacy public_profiles may omit `searchable` / `accountRole`; we exclude only when explicit.
 */
export function isConsumerDirectoryMember(publicDoc, userDoc = null) {
    const id = publicDoc?.id || publicDoc?.uid;
    if (!id) return false;

    if (SUPER_ADMIN_UIDS.includes(String(id))) return false;

    // Google sign-in often leaves `email` blank and stores the address on `authEmail`.
    const emails = [userDoc?.email, userDoc?.authEmail, publicDoc?.email, publicDoc?.authEmail]
        .map((e) => String(e || '').toLowerCase().trim())
        .filter(Boolean);
    if (emails.some((e) => ADMIN_EMAILS.includes(e))) return false;

    if (hasAdminStaffFlag(userDoc) || hasAdminStaffFlag(publicDoc)) return false;

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
