/**
 * Navigate to /login. Prefers React Router (SPA) when the app has registered a navigate
 * function — avoids full document reloads that were leaving users on a blank screen.
 * Falls back to location.assign/replace if called before the router is ready.
 */
function canonicalPath(p) {
    if (!p || p === '/') return '/';
    return p.replace(/\/+$/, '') || '/';
}

let routerNavigate = null;

export function registerLoginRouter(navigate) {
    routerNavigate = navigate;
}

export function unregisterLoginRouter() {
    routerNavigate = null;
}

export function goToLogin(options = {}) {
    if (typeof window === 'undefined') return;
    if (canonicalPath(window.location.pathname) === canonicalPath('/login')) return;

    const replace = Boolean(options.replace);

    if (typeof routerNavigate === 'function') {
        try {
            routerNavigate('/login', { replace });
            return;
        } catch {
            /* fall through to hard navigation */
        }
    }

    const url = `${window.location.origin}/login`;
    if (replace) window.location.replace(url);
    else window.location.assign(url);
}
