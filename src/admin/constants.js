/** Plan / pack environment — never mix sandbox docs into production consumers. */
export const PLAN_ENV = {
    SANDBOX: 'sandbox',
    PRODUCTION: 'production',
};

export const ADMIN_NAV = [
    { path: '/admin/users', label: 'المستخدمون' },
    { path: '/admin/credits', label: 'الرصيد' },
    { path: '/admin/messaging', label: 'المرسل الذكي' },
    { path: '/admin/invitations', label: 'الدعوات' },
    { path: '/admin/reports', label: 'البلاغات' },
    { path: '/admin/plans/sandbox', label: 'خطط Sandbox' },
    { path: '/admin/plans/production', label: 'خطط Production' },
];
