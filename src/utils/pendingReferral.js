const STORAGE_KEY = 'dineb_pending_referral';
const LS_KEY = 'dineb_pending_referral_ls';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** @param {string | null | undefined} raw */
export function validateReferralCodeForStorage(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!/^AGENT-[A-Z0-9]{5,12}$/.test(s)) return null;
    return s;
}

/** Persist referral code for cross-session attribution (30 days). */
export function persistPendingReferralLocal(code) {
    const normalized = validateReferralCodeForStorage(code);
    if (!normalized) return;
    try {
        const exp = Date.now() + THIRTY_DAYS_MS;
        localStorage.setItem(LS_KEY, JSON.stringify({ code: normalized, exp }));
    } catch {
        /* ignore */
    }
}

/** Read pending referral from sessionStorage, then localStorage (if not expired). */
export function peekPendingReferralCode() {
    try {
        const fromSession = validateReferralCodeForStorage(sessionStorage.getItem(STORAGE_KEY));
        if (fromSession) return fromSession;
    } catch {
        /* ignore */
    }
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o || typeof o.code !== 'string') {
            localStorage.removeItem(LS_KEY);
            return null;
        }
        const code = validateReferralCodeForStorage(o.code);
        if (!code || typeof o.exp !== 'number' || Date.now() > o.exp) {
            localStorage.removeItem(LS_KEY);
            return null;
        }
        return code;
    } catch {
        try {
            localStorage.removeItem(LS_KEY);
        } catch {
            /* ignore */
        }
        return null;
    }
}

/**
 * Read `ref` from a URL query string (e.g. location.search), validate, and persist for signup flows.
 * Use this on /login and /signup/business (legacy /business/signup) so referral survives in-app browsers (WhatsApp) and SPA navigations
 * that drop query params.
 * @param {string | null | undefined} searchString — typically `location.search` (with or without leading `?`)
 * @returns {string | null} normalized code or null
 */
export function syncPendingReferralFromQueryString(searchString) {
    try {
        const rawQs = String(searchString || '');
        const q = new URLSearchParams(rawQs.startsWith('?') ? rawQs.slice(1) : rawQs);
        const raw = q.get('ref')?.trim();
        if (!raw) return null;
        const normalized =
            validateReferralCodeForStorage(raw) || validateReferralCodeForStorage(raw.toUpperCase());
        if (!normalized) return null;
        try {
            sessionStorage.setItem(STORAGE_KEY, normalized);
        } catch {
            /* ignore */
        }
        persistPendingReferralLocal(normalized);
        return normalized;
    } catch {
        return null;
    }
}

/** Remove pending referral from sessionStorage and localStorage (call after persisting to Firestore). */
export function clearPendingReferralCode() {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
    try {
        localStorage.removeItem(LS_KEY);
    } catch {
        /* ignore */
    }
}
