/** True when the app runs on a local dev origin (Vite / localhost). */
export function isLocalDevHost() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

/** Firebase Auth allows localhost/127.0.0.1 by default — not LAN IPs like 192.168.x.x */
export function isFirebaseAuthorizedDevHost() {
    if (typeof window === 'undefined') return true;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

const DEFAULT_VITE_DEV_PORTS = ['5176', '5177', '5178', '5179'];

/** Current Vite dev port (defaults to 5176). */
export function getLocalDevPort() {
    if (typeof window === 'undefined') return '5176';
    return window.location.port || '5176';
}

/** Origins to register in Google Cloud → OAuth Web client → Authorized JavaScript origins. */
export function getLocalDevOAuthJavascriptOrigins(port = getLocalDevPort()) {
    const ports = new Set([port, ...DEFAULT_VITE_DEV_PORTS]);
    const origins = [];
    for (const p of ports) {
        origins.push(`http://localhost:${p}`, `http://127.0.0.1:${p}`);
    }
    return [...new Set(origins)];
}

/** Firebase OAuth handler redirect URIs (same for Google / Facebook / Apple on web). */
export function getFirebaseOAuthRedirectUris(projectId, authDomain) {
    const pid = projectId || 'dinebuddies';
    const domain = authDomain || `${pid}.firebaseapp.com`;
    return [
        `https://${domain}/__/auth/handler`,
        `https://${pid}.web.app/__/auth/handler`,
    ];
}

/** Login URL that works with Firebase OAuth on the current dev port. */
export function getLocalDevOAuthLoginUrl() {
    if (typeof window === 'undefined') return 'http://localhost:5176/login';
    const port = getLocalDevPort();
    return `http://localhost:${port}/login`;
}

/**
 * Cursor Simple Browser / VS Code preview — OAuth popups (window.open) are blocked.
 * Use signInWithRedirect instead; see preferOAuthRedirectOnThisDevice().
 */
export function isEmbeddedPreviewBrowser() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Electron/i.test(ua)) return true;
    if (/\bCursor\b/i.test(ua)) return true;
    if (/VSCode|Visual Studio Code/i.test(ua)) return true;
    try {
        const brands = navigator.userAgentData?.brands;
        if (Array.isArray(brands) && brands.some((b) => /electron|cursor/i.test(String(b.brand)))) {
            return true;
        }
    } catch {
        /* ignore */
    }
    try {
        if (window.self !== window.top) return true;
    } catch {
        return true;
    }
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_EMBEDDED_PREVIEW === 'true') return true;
    return false;
}

/**
 * Firebase OAuth redirect (not popup) — Safari / iOS only.
 * Desktop production uses popup (reliable with authDomain on *.firebaseapp.com).
 * Cursor / VS Code preview: use Chrome link in UI — redirect state is unreliable there.
 */
export function isMacSafariBrowser() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) return false;
    if (!/Macintosh|Mac OS X/i.test(ua)) return false;
    if (/Chrome|Chromium|Edg[/\s]|Firefox|OPR|Brave/i.test(ua)) return false;
    const vendor = navigator.vendor || '';
    return /Safari/i.test(ua) && /Apple/i.test(vendor);
}

/** Installed PWA (Add to Home Screen) — OAuth popups break under COOP; use redirect. */
export function isStandalonePwa() {
    if (typeof window === 'undefined') return false;
    try {
        if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    } catch {
        /* ignore */
    }
    return Boolean(window.navigator?.standalone);
}

/** Android phone/tablet Chrome — popup OAuth is unreliable; use redirect like iOS. */
export function isAndroidTouchDevice() {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent || '');
}

export function isMobileTouchDevice() {
    return isIosTouchDevice() || isAndroidTouchDevice();
}

/**
 * Firebase OAuth redirect (not popup):
 * - iOS, Mac Safari, installed PWA → redirect (popup unreliable)
 * - Android Chrome → popup (redirect + cross-origin authDomain breaks Google sign-in)
 * - Desktop → popup first
 */
export function preferOAuthRedirectOnThisDevice() {
    if (isEmbeddedPreviewBrowser()) return false;
    if (isLocalDevHost()) return false;
    if (isAndroidTouchDevice()) return false;
    return isIosTouchDevice() || isMacSafariBrowser() || isStandalonePwa();
}

/**
 * Prefer redirect when popup OAuth is unreliable or floods COOP console noise.
 * - iOS / Mac Safari / PWA → redirect (existing device policy)
 * - Desktop Google/Apple → redirect (Chrome COOP blocks window.closed polling)
 * - Android → popup (redirect + cross-origin authDomain breaks Google there)
 * - Facebook → popup first (redirect fallback only if blocked)
 */
export function preferOAuthRedirectForProvider(providerId) {
    // Localhost: keep popup — Firebase redirect + authDomain is unreliable on Vite ports.
    if (isLocalDevHost() || isEmbeddedPreviewBrowser() || isAndroidTouchDevice()) {
        return false;
    }
    if (preferOAuthRedirectOnThisDevice()) return true;
    const id = String(providerId || '');
    return id === 'google.com' || id === 'apple.com';
}

/** @deprecated Use preferOAuthRedirectOnThisDevice */
export function preferGoogleOAuthRedirect() {
    return preferOAuthRedirectOnThisDevice();
}

/** iPhone / iPad / iOS Safari (including iPadOS desktop UA). */
export function isIosTouchDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

const OAUTH_PENDING_KEY = 'dineb_oauth_redirect_pending';
const OAUTH_PROVIDER_KEY = 'dineb_oauth_redirect_provider';
const OAUTH_STARTED_KEY = 'dineb_oauth_redirect_started';
const OAUTH_COMPLETE_KEY = 'dineb_oauth_redirect_complete';
const OAUTH_ERROR_KEY = 'dineb_oauth_redirect_error';
const POST_LOGOUT_KEY = 'dineb_post_logout';
const OAUTH_PENDING_MAX_MS = 5 * 60 * 1000;

/** iOS Safari may drop sessionStorage across OAuth redirects — mirror to localStorage. */
function oauthRead(key) {
    const stores = isIosTouchDevice() ? [localStorage, sessionStorage] : [sessionStorage];
    for (const store of stores) {
        try {
            const value = store.getItem(key);
            if (value != null && value !== '') return value;
        } catch {
            /* ignore */
        }
    }
    return null;
}

function oauthWrite(key, value) {
    const stores = isIosTouchDevice() ? [localStorage, sessionStorage] : [sessionStorage];
    for (const store of stores) {
        try {
            store.setItem(key, value);
        } catch {
            /* ignore */
        }
    }
}

function oauthRemove(key) {
    for (const store of [localStorage, sessionStorage]) {
        try {
            store.removeItem(key);
        } catch {
            /* ignore */
        }
    }
}

/** Remove Firebase OAuth hash/query after redirect so the SPA URL stays clean. */
export function stripFirebaseAuthParamsFromUrl() {
    if (typeof window === 'undefined') return;
    if (!hasFirebaseAuthReturnInUrl()) return;
    try {
        const { pathname, search, hash } = window.location;
        const params = new URLSearchParams(search);
        ['apiKey', 'authType', 'mode', 'oobCode', 'continueUrl', 'lang'].forEach((k) => params.delete(k));
        const nextSearch = params.toString();
        let nextHash = hash || '';
        if (/apiKey=|authType=|oobCode=/i.test(nextHash)) {
            nextHash = '';
        }
        const clean = pathname + (nextSearch ? `?${nextSearch}` : '') + nextHash;
        window.history.replaceState({}, document.title, clean);
    } catch {
        /* ignore */
    }
}

export function stashOAuthRedirectError(error) {
    if (!error) return;
    try {
        oauthWrite(
            OAUTH_ERROR_KEY,
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
        const raw = oauthRead(OAUTH_ERROR_KEY);
        oauthRemove(OAUTH_ERROR_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearOAuthRedirectPending() {
    try {
        oauthRemove(OAUTH_PENDING_KEY);
        oauthRemove(OAUTH_PROVIDER_KEY);
        oauthRemove(OAUTH_STARTED_KEY);
    } catch {
        /* ignore */
    }
}

function readOAuthRedirectStartedAt() {
    try {
        const raw = oauthRead(OAUTH_STARTED_KEY);
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
}

/** True when an OAuth redirect was started recently (avoids stale-flag error banners). */
export function isRecentOAuthRedirectAttempt(maxAgeMs = 120000) {
    const started = readOAuthRedirectStartedAt();
    return Boolean(started && Date.now() - started <= maxAgeMs);
}

/** Pending flag with auto-expire — stale flags were freezing the login page on iPhone. */
export function peekOAuthRedirectPending() {
    try {
        if (oauthRead(OAUTH_PENDING_KEY) !== '1') return false;
        const started = readOAuthRedirectStartedAt();
        if (!started) return true;
        if (Date.now() - started > OAUTH_PENDING_MAX_MS) {
            clearOAuthRedirectPending();
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export function getLocalDevLoginUrl() {
    if (typeof window === 'undefined') return 'http://localhost:5176/login';
    return `${window.location.origin}/login`;
}

/** Drop guest browsing before OAuth — guestMode during Apple redirect caused a stuck login UI. */
export function clearGuestModeForSignIn() {
    try {
        localStorage.removeItem('guestMode');
    } catch {
        /* ignore */
    }
}

export function markPostLogoutRedirect() {
    try {
        sessionStorage.setItem(POST_LOGOUT_KEY, '1');
    } catch {
        /* ignore */
    }
}

export function peekPostLogoutRedirect() {
    try {
        return sessionStorage.getItem(POST_LOGOUT_KEY) === '1';
    } catch {
        return false;
    }
}

export function clearPostLogoutRedirect() {
    try {
        sessionStorage.removeItem(POST_LOGOUT_KEY);
    } catch {
        /* ignore */
    }
}

export function clearStaleOAuthRedirectFlags() {
    try {
        if (hasFirebaseAuthReturnInUrl()) return;
        peekOAuthRedirectPending();
        const started = readOAuthRedirectStartedAt();
        const stale = !started || Date.now() - started > OAUTH_PENDING_MAX_MS;
        if (stale) {
            clearOAuthRedirectPending();
            oauthRemove(OAUTH_COMPLETE_KEY);
        }
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
        oauthRemove(OAUTH_PENDING_KEY);
        oauthRemove(OAUTH_PROVIDER_KEY);
        oauthWrite(OAUTH_COMPLETE_KEY, '1');
    } catch {
        /* ignore */
    }
}

/** Call immediately before signInWithRedirect so we can detect a failed return. */
export function markOAuthRedirectPending(providerId) {
    try {
        clearGuestModeForSignIn();
        oauthWrite(OAUTH_PENDING_KEY, '1');
        oauthWrite(OAUTH_STARTED_KEY, String(Date.now()));
        oauthRemove(OAUTH_COMPLETE_KEY);
        if (providerId) {
            oauthWrite(OAUTH_PROVIDER_KEY, String(providerId));
        }
    } catch {
        /* ignore */
    }
}

/** @returns {string | null} */
export function peekOAuthRedirectProvider() {
    try {
        const raw = oauthRead(OAUTH_PROVIDER_KEY);
        return raw && String(raw).trim() ? String(raw).trim() : null;
    } catch {
        return null;
    }
}

export function peekOAuthRedirectComplete() {
    try {
        return oauthRead(OAUTH_COMPLETE_KEY) === '1';
    } catch {
        return false;
    }
}

/** @returns {boolean} */
export function consumeOAuthRedirectComplete() {
    try {
        if (oauthRead(OAUTH_COMPLETE_KEY) === '1') {
            oauthRemove(OAUTH_COMPLETE_KEY);
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
        if (oauthRead(OAUTH_PENDING_KEY) === '1') {
            clearOAuthRedirectPending();
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
