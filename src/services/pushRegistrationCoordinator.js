import {
    ensurePushRegistration,
    isPushEnabledInPrefs,
    isIOS,
    warmupPushServiceWorker,
} from './notificationService';

let inFlight = null;
let lastUid = null;
let lastRunAt = 0;
const DEBOUNCE_MS = 1500;

/**
 * Single entry for FCM token refresh — avoids parallel getToken races (especially iOS PWA cold start).
 * Never requests Notification.permission; callers must use initNotifications from UI for that.
 */
export async function schedulePushRegistration(uid, { force = false } = {}) {
    if (!uid) return null;

    const now = Date.now();
    if (!force && inFlight && lastUid === uid) {
        return inFlight;
    }
    if (!force && lastUid === uid && now - lastRunAt < DEBOUNCE_MS) {
        return inFlight || null;
    }

    lastUid = uid;
    lastRunAt = now;

    inFlight = (async () => {
        try {
            warmupPushServiceWorker();
            if (!(await isPushEnabledInPrefs(uid))) return null;
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
                return null;
            }
            let token = await ensurePushRegistration(uid, { quick: true });
            if (!token) {
                token = await ensurePushRegistration(uid, { quick: false });
            }
            return token;
        } catch (e) {
            console.warn('[FCM] schedulePushRegistration:', e?.message || e);
            return null;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/** Fire-and-forget retries after the user enables push (do not block the toggle). */
export function startBackgroundPushRegistration(uid) {
    if (!uid) return;
    // iOS first token requires user gesture — background retries never succeed.
    if (isIOS()) return;
    void schedulePushRegistration(uid, { force: true });
    [2500, 7000, 18000].forEach((ms) => {
        setTimeout(() => {
            void schedulePushRegistration(uid, { force: true });
        }, ms);
    });
}
