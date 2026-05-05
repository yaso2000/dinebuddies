/**
 * Single source for admin panel navigation (used by embedded admin shell).
 */
export const ADMIN_NAV_GROUPS = [
    {
        titleKey: 'admin_nav_overview',
        items: [
            { path: '/admin/dashboard', labelKey: 'admin_nav_dashboard', roles: ['admin', 'moderator', 'support'] },
        ],
    },
    {
        titleKey: 'admin_nav_group_accounts',
        items: [
            { path: '/admin/accounts', labelKey: 'admin_nav_item_accounts', roles: ['admin', 'moderator', 'support'] },
        ],
    },
    {
        titleKey: 'admin_nav_billing',
        items: [
            { path: '/admin/subscriptions', labelKey: 'admin_nav_subscriptions', roles: ['admin'] },
            { path: '/admin/plans', labelKey: 'admin_nav_plans', roles: ['admin'] },
            { path: '/admin/grant-credits', labelKey: 'admin_nav_grant_credits', roles: ['admin'] },
        ],
    },
    {
        titleKey: 'admin_nav_safety',
        items: [
            { path: '/admin/reports', labelKey: 'admin_nav_reports', roles: ['admin', 'moderator'] },
            { path: '/admin/audit-log', labelKey: 'admin_nav_audit', roles: ['admin'] },
        ],
    },
    {
        titleKey: 'admin_nav_content',
        items: [
            { path: '/admin/invitations', labelKey: 'admin_nav_invitations', roles: ['admin', 'moderator'] },
            { path: '/admin/chat-community', labelKey: 'admin_nav_chat', roles: ['admin', 'moderator'] },
        ],
    },
    {
        titleKey: 'admin_nav_ops',
        items: [
            { path: '/admin/notifications', labelKey: 'admin_nav_notifications', roles: ['admin'] },
            { path: '/admin/migration', labelKey: 'admin_nav_migration', roles: ['admin'] },
            { path: '/admin/system-tools', labelKey: 'admin_nav_system_tools', roles: ['admin'] },
            { path: '/admin/backups', labelKey: 'admin_nav_backups', roles: ['admin'] },
        ],
    },
    {
        titleKey: 'admin_nav_settings',
        items: [{ path: '/admin/settings', labelKey: 'admin_nav_settings', roles: ['admin'] }],
    },
];

export function canSeeAdminNavItem(roles, isAdminIdentityUser, userRole) {
    const r = userRole != null && userRole !== '' ? String(userRole) : null;
    if (isAdminIdentityUser) return true;
    if (!roles || roles.length === 0) return false;
    return r != null && roles.includes(r);
}
