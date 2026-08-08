import { sanitizeNextPath } from './safeInternalPath';

/**
 * Navigate to /login. Prefers React Router (SPA) when the app has registered a navigate
 * function — avoids full document reloads that were leaving users on a blank screen.
 * Falls back to location.assign/replace if called before the router is ready.
 */
export function buildLoginPath(options = {}) {
    const returnPath = sanitizeNextPath(options.returnPath || options.next);
    return returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : '/login';
}

/** Current SPA path safe for post-login `?next=` (pathname only; ids live in the path). */
export function getCurrentReturnPath() {
    if (typeof window === 'undefined') return null;
    return sanitizeNextPath(
        `${window.location.pathname || ''}${window.location.search || ''}`
    );
}

function canonicalPath(p) {    if (!p || p === '/') return '/';
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

    const loginPath = buildLoginPath(options);

    if (canonicalPath(window.location.pathname) === canonicalPath('/login')) return;

    const replace = Boolean(options.replace);

    if (typeof routerNavigate === 'function') {
        try {
            routerNavigate(loginPath, { replace });
            return;
        } catch {
            /* fall through to hard navigation */
        }
    }

    const url = `${window.location.origin}${loginPath}`;
    if (replace) window.location.replace(url);
    else window.location.assign(url);
}
