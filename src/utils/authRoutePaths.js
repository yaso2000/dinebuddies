/** Routes that stay mounted while AuthContext resolves (login / signup flows only). */
export function isAuthRoutePath(pathname = '') {
    const p = String(pathname || '');
    return (
        p === '/login' ||
        p === '/auth/action' ||
        p.startsWith('/affiliate/login') ||
        p.startsWith('/affiliate/signup') ||
        p.startsWith('/signup/business') ||
        p.startsWith('/business/login')
    );
}
