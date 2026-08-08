/**
 * Device-level FCM token persistence (survives app restarts and user logout).
 * Firestore links tokens per user; localStorage keeps the device token for silent re-link.
 */

const TOKEN_KEY = 'db:deviceFcmToken';
const LINKED_UID_KEY = 'db:deviceFcmTokenLinkedUid';
const SAVED_AT_KEY = 'db:deviceFcmTokenSavedAt';

const bootstrapCache = new Map();

export function getLocalDeviceFcmToken() {
    if (typeof localStorage === 'undefined') return null;
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token || token.length < 80) return null;
        return {
            token,
            linkedUid: localStorage.getItem(LINKED_UID_KEY) || null,
            savedAt: localStorage.getItem(SAVED_AT_KEY) || null,
        };
    } catch {
        return null;
    }
}

export function setLocalDeviceFcmToken(token, linkedUid = null) {
    if (typeof localStorage === 'undefined' || !token) return;
    try {
        localStorage.setItem(TOKEN_KEY, String(token));
        if (linkedUid) {
            localStorage.setItem(LINKED_UID_KEY, String(linkedUid));
        } else {
            localStorage.removeItem(LINKED_UID_KEY);
        }
        localStorage.setItem(SAVED_AT_KEY, String(Date.now()));
    } catch {
        /* ignore */
    }
}

export function clearLocalDeviceFcmToken() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(LINKED_UID_KEY);
        localStorage.removeItem(SAVED_AT_KEY);
    } catch {
        /* ignore */
    }
}

/** Logout: keep device token, drop which user it was linked to. */
export function clearLocalFcmLinkedUid() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(LINKED_UID_KEY);
    } catch {
        /* ignore */
    }
}

export function clearBootstrapCache(uid) {
    if (uid) bootstrapCache.delete(uid);
    else bootstrapCache.clear();
}

/**
 * Wait for service worker (iOS cold start can lag behind auth).
 */
export async function waitForPushInfraReady(maxMs = 14000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.ready;
                return true;
            } catch {
                /* retry */
            }
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}
