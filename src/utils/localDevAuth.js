/** True when the app runs on a local dev origin (Vite / localhost). */
export function isLocalDevHost() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Cursor Simple Browser / Glass preview, VS Code webview, etc.
 * Popups may be blocked; fallback to redirect when needed.
 */
export function isEmbeddedPreviewBrowser() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Electron/i.test(ua)) return true;
    if (/Cursor/i.test(ua)) return true;
    try {
        if (window.self !== window.top) return true;
    } catch {
        return true;
    }
    return false;
}

/** Google: popup on Chrome localhost + Cursor preview; redirect on Safari. */
export function preferGoogleOAuthRedirect() {
    if (isEmbeddedPreviewBrowser()) return false;
    if (isLocalDevHost()) return false;
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    if (!/Macintosh|Mac OS X/i.test(ua)) return false;
    if (/Chrome|Chromium|Edg[/\s]|Firefox|OPR|Brave/i.test(ua)) return false;
    const vendor = navigator.vendor || '';
    return /Safari/i.test(ua) && /Apple/i.test(vendor);
}

export function getLocalDevLoginUrl() {
    if (typeof window === 'undefined') return 'http://localhost:5176/login';
    return `${window.location.origin}/login`;
}

export function clearStaleOAuthRedirectFlags() {
    try {
        if (hasFirebaseAuthReturnInUrl()) return;
        sessionStorage.removeItem('dineb_oauth_redirect_pending');
    } catch {
        /* ignore */
    }
}

/** True when URL contains params from a Firebase OAuth redirect return. */
export function hasFirebaseAuthReturnInUrl() {
    if (typeof window === 'undefined') return false;
    const combined = `${window.location.hash || ''}${window.location.search || ''}`;
    return /apiKey=|authType=|oobCode=/i.test(combined);
}

export function markOAuthRedirectComplete() {
    try {
        sessionStorage.removeItem('dineb_oauth_redirect_pending');
        sessionStorage.setItem('dineb_oauth_redirect_complete', '1');
    } catch {
        /* ignore */
    }
}

/** Call immediately before signInWithRedirect so we can detect a failed return. */
export function markOAuthRedirectPending() {
    try {
        sessionStorage.setItem('dineb_oauth_redirect_pending', '1');
        sessionStorage.removeItem('dineb_oauth_redirect_complete');
    } catch {
        /* ignore */
    }
}

/** @returns {boolean} */
export function consumeOAuthRedirectComplete() {
    try {
        if (sessionStorage.getItem('dineb_oauth_redirect_complete') === '1') {
            sessionStorage.removeItem('dineb_oauth_redirect_complete');
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

/** @returns {boolean} */
export function consumeOAuthRedirectPending() {
    try {
        if (sessionStorage.getItem('dineb_oauth_redirect_pending') === '1') {
            sessionStorage.removeItem('dineb_oauth_redirect_pending');
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

export async function openLoginInExternalBrowser() {
    if (typeof window === 'undefined') return { ok: false, url: '' };
    const url = `${window.location.origin}/login`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) {
        try {
            opened.opener = null;
        } catch {
            /* ignore */
        }
        return { ok: true, mode: 'window', url };
    }
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            return { ok: true, mode: 'clipboard', url };
        }
    } catch {
        /* ignore */
    }
    return { ok: false, url };
}
