const STORAGE_KEY = 'dineb_auth_gate_notice';

/**
 * Persist a one-shot notice for the login screen after a forced sign-out (e.g. platform guard).
 * @param {{ i18nKey?: string, message?: string, variant?: 'error' | 'info' }} payload
 */
export function stashAuthGateNotice(payload) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
    } catch {
        /* ignore */
    }
}

/** @returns {{ i18nKey?: string, message?: string, variant?: string } | null} */
export function consumeAuthGateNotice() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        return o && typeof o === 'object' ? o : null;
    } catch {
        return null;
    }
}
