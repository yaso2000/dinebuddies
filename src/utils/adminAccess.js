const ADMIN_EMAILS = [
    'admin@dinebuddies.com',
    'yaser@dinebuddies.com',
    'info@dinebuddies.com.au',
    'y.abohamed@gmail.com'
];

const SUPER_ADMIN_UIDS = ['xTgHC1v00LZIZ6ESA9YGjGU5zW33'];

/** Firestore roles that may use `/admin/*` (same set as AdminRoute allowedRoles). */
const ADMIN_PANEL_ROLES = new Set(['admin', 'moderator', 'support', 'staff']);

export function isAdminPanelStaffRole(userProfile) {
    return ADMIN_PANEL_ROLES.has(String(userProfile?.role || '').toLowerCase());
}

export function isAdminIdentity(currentUser, userProfile) {
    const email = String(currentUser?.email || userProfile?.email || '').toLowerCase();
    const uid = currentUser?.uid || currentUser?.id || userProfile?.uid || userProfile?.id;
    const role = String(userProfile?.role || '').toLowerCase();
    return role === 'admin' || ADMIN_EMAILS.includes(email) || SUPER_ADMIN_UIDS.includes(uid);
}

/** True if this user should be sent to the admin app shell after login (identity or staff role on profile). */
export function shouldLandOnAdminDashboard(currentUser, userProfile) {
    if (userProfile && isAdminPanelStaffRole(userProfile)) return true;
    return isAdminIdentity(currentUser, userProfile);
}

