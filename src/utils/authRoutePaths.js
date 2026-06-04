/** Routes that must stay visible while AuthContext `loading` is true (avoid full-screen spinner). */
export function isAuthRoutePath(pathname = '') {
    const p = String(pathname || '');
    return (
        p === '/login' ||
        p === '/auth/action' ||
        p === '/verify-email' ||
        p === '/complete-profile' ||
        p.startsWith('/affiliate/login') ||
        p.startsWith('/affiliate/signup') ||
        p.startsWith('/signup/business') ||
        p.startsWith('/business/login')
    );
}
