/**
 * FCM token acquisition — main thread only (window / localStorage allowed here, NOT in the SW).
 * Single pipeline: permission → serviceWorker.ready → getToken(vapidKey + serviceWorkerRegistration).
 */
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import app from '../firebase/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const SW_URL = '/firebase-messaging-sw.js';
const SW_SCOPE = '/';

function scriptIsFcmWorker(reg) {
    const u =
        reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || '';
    return u.includes('firebase-messaging-sw.js');
}

/**
 * Register / refresh the FCM service worker and wait until it controls this page.
 * @returns {Promise<ServiceWorkerRegistration>}
 */
export async function ensureFcmServiceWorkerRegistered() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        const err = new Error('Service workers are not supported in this browser');
        err.code = 'fcm/no-service-worker';
        throw err;
    }

    let registration = await navigator.serviceWorker.getRegistration(SW_SCOPE).catch(() => null);

    if (registration && !scriptIsFcmWorker(registration)) {
        try {
            await registration.unregister();
        } catch {
            /* ignore */
        }
        registration = null;
    }

    if (!registration) {
        console.info('[FCM] Registering service worker:', SW_URL);
        registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    }

    try {
        await registration.update();
    } catch {
        /* ignore */
    }

    await navigator.serviceWorker.ready;
    console.info('[FCM] serviceWorker.ready', {
        active: registration.active?.state,
        script: registration.active?.scriptURL?.slice(-48) || '',
        controller: Boolean(navigator.serviceWorker.controller),
    });

    return registration;
}

/**
 * Obtain FCM device token when Notification.permission is already "granted".
 * @param {{ label?: string }} [opts]
 * @returns {Promise<{ token: string | null, error: { code: string, message: string } | null, registration: ServiceWorkerRegistration | null }>}
 */
export async function obtainFcmDeviceToken(opts = {}) {
    const label = opts.label || 'obtainFcmDeviceToken';

    if (typeof Notification === 'undefined') {
        const error = { code: 'fcm/no-notification-api', message: 'Notification API unavailable' };
        console.error(`[FCM] ${label}:`, error);
        return { token: null, error, registration: null };
    }

    if (Notification.permission !== 'granted') {
        const error = {
            code: 'fcm/permission-not-granted',
            message: `Notification.permission is "${Notification.permission}", not "granted"`,
        };
        console.error(`[FCM] ${label}:`, error);
        return { token: null, error, registration: null };
    }

    if (!VAPID_KEY || !String(VAPID_KEY).trim()) {
        const error = { code: 'fcm/missing-vapid', message: 'VITE_FIREBASE_VAPID_KEY is missing' };
        console.error(`[FCM] ${label}:`, error);
        return { token: null, error, registration: null };
    }

    let registration = null;

    try {
        const supported = await isSupported().catch(() => false);
        if (!supported) {
            const error = { code: 'fcm/not-supported', message: 'Firebase Messaging is not supported' };
            console.error(`[FCM] ${label}:`, error);
            return { token: null, error, registration: null };
        }

        registration = await ensureFcmServiceWorkerRegistered();

        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (!token || String(token).length < 80) {
            const error = { code: 'fcm/empty-token', message: 'getToken returned empty or invalid token' };
            console.error(`[FCM] ${label}:`, error);
            return { token: null, error, registration };
        }

        console.info(`[FCM] ${label}: token obtained`, { length: token.length });
        return { token, error: null, registration };
    } catch (err) {
        const error = {
            code: err?.code || err?.name || 'fcm/get-token-failed',
            message: String(err?.message || err),
        };
        console.error(`[FCM] ${label}: getToken failed`, error, err);
        return { token: null, error, registration };
    }
}

export function getFcmVapidKeyPresent() {
    return Boolean(VAPID_KEY && String(VAPID_KEY).trim());
}
