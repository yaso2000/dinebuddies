/**
 * Team / admin accounts must never appear in consumer directory, search, or social graphs.
 * Keep in sync with src/utils/adminAccess.js + consumerSearchExclusions.js.
 */
const ADMIN_EMAILS = new Set(
    [
        'admin@dinebuddies.com',
        'yaser@dinebuddies.com',
        'info@dinebuddies.com.au',
        'y.abohamed@gmail.com',
    ].map((e) => e.toLowerCase())
);

const SUPER_ADMIN_UIDS = new Set([
    'xTgHC1v00LZIZ6ESA9YGjGU5zW33',
    'xboOb7jxpGbYVRgZyP66d544nVi1',
]);

// `regional_manager` is panel staff too — they must be hidden from the consumer app
// exactly like any other admin/staff account.
const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent', 'regional_manager']);

function isConsumerHiddenUid(uid) {
    return SUPER_ADMIN_UIDS.has(String(uid || '').trim());
}

function isConsumerHiddenEmail(email) {
    return ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());
}

/** Admin recognized by EITHER the profile email or the auth email (Google sign-in often
 *  stores the address under `authEmail`, leaving `email` blank — the old check missed it). */
function isConsumerHiddenEmailAny(userData) {
    return isConsumerHiddenEmail(userData?.email) || isConsumerHiddenEmail(userData?.authEmail);
}

function isConsumerHiddenRole(role) {
    return TEAM_ROLES.has(String(role || '').toLowerCase());
}

/** Durable admin/staff markers stamped on the users doc (independent of the `role` field). */
function isAdminStaffFlag(userData) {
    if (!userData) return false;
    if (userData.isAdmin === true || userData.isStaff === true || userData.isTeamMember === true) return true;
    if (String(userData.accountType || '').toLowerCase() === 'admin') return true;
    return false;
}

/**
 * Admin / team-staff identity for a `users/{uid}` doc — the signals that mean "this is
 * NOT a regular consumer": super-admin uid, a team role, a durable admin flag, or a
 * known admin email (profile or auth). Used both to hide the account and to forbid it
 * from personal chat. Does NOT include guest/banned/frozen (those are lifecycle states,
 * hidden separately but still ordinary users).
 */
function isAdminStaffUserDoc(userData, uid) {
    const safeUid = String(uid || userData?.uid || '').trim();
    if (isConsumerHiddenUid(safeUid)) return true;
    if (!userData) return false;
    if (isConsumerHiddenRole(userData.role)) return true;
    if (isAdminStaffFlag(userData)) return true;
    if (isConsumerHiddenEmailAny(userData)) return true;
    return false;
}

/** Full `users/{uid}` document. */
function isConsumerHiddenUserDoc(userData, uid) {
    const safeUid = String(uid || userData?.uid || '').trim();
    if (isConsumerHiddenUid(safeUid)) return true;
    if (!userData) return false;
    if (userData.isGuest === true) return true;
    if (userData.banned === true) return true;
    // Self-service lifecycle: a frozen (deactivated) or pending-deletion account
    // must vanish from discovery / search / social everywhere until reactivated.
    if (userData.accountState === 'deactivated' || userData.accountState === 'pending_deletion') return true;
    if (isAdminStaffUserDoc(userData, safeUid)) return true;
    return false;
}

/** `public_profiles` projection document. */
function isConsumerHiddenPublicProfile(data, id) {
    const safeId = String(id || data?.uid || '').trim();
    if (isConsumerHiddenUid(safeId)) return true;
    if (!data) return false;
    if (data.isGuest === true) return true;
    if (data.searchable === false) return true;
    if (isConsumerHiddenRole(data.accountRole)) return true;
    return false;
}

module.exports = {
    isConsumerHiddenUserDoc,
    isConsumerHiddenPublicProfile,
    isAdminStaffUserDoc,
    isConsumerHiddenRole,
    isConsumerHiddenUid,
    isConsumerHiddenEmail,
};
