const STORAGE_KEY = 'dineb_pending_referral';

/** @param {string | null | undefined} raw */
export function validateReferralCodeForStorage(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!/^AGENT-[A-Z0-9]{5,12}$/.test(s)) return null;
    return s;
}

/** Read pending referral from sessionStorage without removing it. */
export function peekPendingReferralCode() {
    try {
        return validateReferralCodeForStorage(sessionStorage.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
}

/** Remove pending referral from sessionStorage (call after persisting to Firestore). */
export function clearPendingReferralCode() {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
