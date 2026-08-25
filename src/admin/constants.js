import { isCashoutFeatureEnabled } from '../config/cashoutFeature';

/** Admin navigation — business billing is Stripe env + /settings/subscription only. */
const ADMIN_NAV_BASE = [
    { path: '/admin/google-places', labelKey: 'admin_nav_google_places' },
    { path: '/admin/demo-users', labelKey: 'admin_nav_demo_users' },
    { path: '/admin/users', labelKey: 'admin_nav_users' },
    { path: '/admin/businesses', labelKey: 'admin_nav_businesses' },
    { path: '/admin/posts', labelKey: 'admin_nav_posts' },
    { path: '/admin/invitations', labelKey: 'admin_nav_invitations' },
    { path: '/admin/credits', labelKey: 'admin_nav_credits' },
    { path: '/admin/cashouts', labelKey: 'admin_nav_cashouts' },
    { path: '/admin/messaging', labelKey: 'admin_nav_messaging' },
    { path: '/admin/reports', labelKey: 'admin_nav_reports' },
    { path: '/admin/support', labelKey: 'admin_nav_support' },
];

export const ADMIN_NAV = isCashoutFeatureEnabled()
    ? ADMIN_NAV_BASE
    : ADMIN_NAV_BASE.filter((item) => item.path !== '/admin/cashouts');
