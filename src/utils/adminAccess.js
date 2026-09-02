export const ADMIN_EMAILS = [
    'admin@dinebuddies.com',
    'yaser@dinebuddies.com',
    'info@dinebuddies.com.au',
    'y.abohamed@gmail.com',
];

export const SUPER_ADMIN_UIDS = [
    'xTgHC1v00LZIZ6ESA9YGjGU5zW33',
    'xboOb7jxpGbYVRgZyP66d544nVi1',
];

/** Firestore roles that may use `/admin/*` (same set as AdminRoute allowedRoles). */
const ADMIN_PANEL_ROLES = new Set(['admin', 'moderator', 'support', 'staff', 'regional_manager']);

export function isAdminPanelStaffRole(userProfile) {
    return ADMIN_PANEL_ROLES.has(String(userProfile?.role || '').toLowerCase());
}

/* ---------------------------------------------------------------------------
 * Regional managers: scoped panel staff who see/act on ONE geography only and
 * never touch money, global tools, or account deletion. A manager's user doc
 * carries `role: 'regional_manager'` + `region: '<key>'` (e.g. 'gulf').
 * ------------------------------------------------------------------------- */

/** Supported admin regions → the ISO country codes they cover. */
export const ADMIN_REGIONS = {
    gulf: {
        key: 'gulf',
        labelKey: 'admin_region_gulf',
        defaultLabel: 'الخليج العربي',
        countryCodes: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
    },
};

/** Admin paths a regional manager may NOT open (money + global tools + destructive). */
export const ADMIN_OWNER_ONLY_PATHS = new Set([
    '/admin/credits',
    '/admin/cashouts',
    '/admin/messaging',
]);

export function isRegionalManager(userProfile) {
    return String(userProfile?.role || '').toLowerCase() === 'regional_manager';
}

/** Region config for a manager, or null when the user is a full/global admin. */
export function getAdminRegion(userProfile) {
    if (!isRegionalManager(userProfile)) return null;
    const key = String(userProfile?.region || '').toLowerCase();
    return ADMIN_REGIONS[key] || null;
}

/** ISO country codes this user is scoped to, or null = no restriction (full admin). */
export function getAdminRegionCountryCodes(userProfile) {
    const region = getAdminRegion(userProfile);
    return region ? region.countryCodes : null;
}

/** May this user open this admin path? Regional managers are blocked from owner-only paths. */
export function canAccessAdminPath(userProfile, path) {
    if (isRegionalManager(userProfile)) return !ADMIN_OWNER_ONLY_PATHS.has(path);
    return true;
}

/** Filter an admin nav list down to what the current user may open. */
export function filterAdminNav(navItems, userProfile) {
    if (!isRegionalManager(userProfile)) return navItems;
    return (navItems || []).filter((item) => !ADMIN_OWNER_ONLY_PATHS.has(item.path));
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

