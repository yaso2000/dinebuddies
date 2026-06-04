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

/**
 * Firebase OAuth redirect (not popup) — reliable on localhost and Safari.
 * Embedded preview (Cursor iframe): use popup; redirect often breaks in iframes.
 */
export function preferOAuthRedirectOnThisDevice() {
    if (isEmbeddedPreviewBrowser()) return false;
    // Chrome/Firefox on localhost: popup is more reliable than redirect + getRedirectResult.
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

/** @deprecated Use preferOAuthRedirectOnThisDevice */
export function preferGoogleOAuthRedirect() {
    return preferOAuthRedirectOnThisDevice();
}

/** Remove Firebase OAuth hash/query after redirect so the SPA URL stays clean. */
export function stripFirebaseAuthParamsFromUrl() {
    if (typeof window === 'undefined') return;
    if (!hasFirebaseAuthReturnInUrl()) return;
    try {
        const { pathname, search } = window.location;
        const params = new URLSearchParams(search);
        ['apiKey', 'authType', 'mode', 'oobCode', 'continueUrl', 'lang'].forEach((k) => params.delete(k));
        const nextSearch = params.toString();
        const clean = pathname + (nextSearch ? `?${nextSearch}` : '');
        window.history.replaceState({}, document.title, clean);
    } catch {
        /* ignore */
    }
}

export function stashOAuthRedirectError(error) {
    if (!error) return;
    try {
        sessionStorage.setItem(
            'dineb_oauth_redirect_error',
            JSON.stringify({
                code: error.code || '',
                message: error.message || String(error),
            })
        );
    } catch {
        /* ignore */
    }
}

/** @returns {{ code?: string, message?: string } | null} */
export function consumeOAuthRedirectError() {
    try {
        const raw = sessionStorage.getItem('dineb_oauth_redirect_error');
        sessionStorage.removeItem('dineb_oauth_redirect_error');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearOAuthRedirectPending() {
    try {
        sessionStorage.removeItem('dineb_oauth_redirect_pending');
    } catch {
        /* ignore */
    }
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

export function peekOAuthRedirectComplete() {
    try {
        return sessionStorage.getItem('dineb_oauth_redirect_complete') === '1';
    } catch {
        return false;
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
