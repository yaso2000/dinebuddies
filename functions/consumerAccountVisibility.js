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

const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent']);

function isConsumerHiddenUid(uid) {
    return SUPER_ADMIN_UIDS.has(String(uid || '').trim());
}

function isConsumerHiddenEmail(email) {
    return ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());
}

function isConsumerHiddenRole(role) {
    return TEAM_ROLES.has(String(role || '').toLowerCase());
}

/** Full `users/{uid}` document. */
function isConsumerHiddenUserDoc(userData, uid) {
    const safeUid = String(uid || userData?.uid || '').trim();
    if (isConsumerHiddenUid(safeUid)) return true;
    if (!userData) return false;
    if (userData.isGuest === true) return true;
    if (userData.banned === true) return true;
    if (isConsumerHiddenRole(userData.role)) return true;
    if (isConsumerHiddenEmail(userData.email)) return true;
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
    isConsumerHiddenRole,
    isConsumerHiddenUid,
    isConsumerHiddenEmail,
};
