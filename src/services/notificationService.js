/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * One worker: /firebase-messaging-sw.js (PWA precache + messaging). Do not register /sw.js.
 */
import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import app from '../firebase/config';
import { db } from '../firebase/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
let _foregroundListenerAttached = false;

/** True for iPhone/iPad Safari or installed PWA WebKit (includes iPad “desktop” UA). */
export function isIosDevice() {
    if (typeof navigator === 'undefined') return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    // iPadOS 13+ often reports MacIntel + touch points when “desktop” mode is on.
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** Apple Web Push requires the app to be opened from the Home Screen (standalone), not a normal Safari tab. */
export function isIosStandalonePwa() {
    if (!isIosDevice()) return false;
    try {
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch {
        /* ignore */
    }
    return Boolean(window.navigator.standalone);
}

/** iOS 16.4+ only — earlier versions cannot receive web push. */
export function isIosWebPushSupportedVersion() {
    if (!isIosDevice()) return true;
    const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
    if (!m) return true;
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2], 10);
    if (Number.isNaN(major)) return true;
    if (major < 16) return false;
    if (major === 16 && minor < 4) return false;
    return true;
}

async function waitForServiceWorkerActive(reg, timeoutMs = 8000) {
    if (!reg) return;
    if (reg.active?.state === 'activated') return;
    const w = reg.installing || reg.waiting || reg.active;
    if (!w) return;
    if (w.state === 'activated') return;
    await new Promise((resolve) => {
        const done = () => resolve();
        const t = setTimeout(done, timeoutMs);
        w.addEventListener(
            'statechange',
            () => {
                if (w.state === 'activated') {
                    clearTimeout(t);
                    done();
                }
            },
            { once: true }
        );
    });
}

function getMsg() {
    if (_messaging) return _messaging;
    try {
        _messaging = getMessaging(app);
    } catch {
        _messaging = null;
    }
    return _messaging;
}

async function getFcmServiceWorkerRegistration() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;

    await navigator.serviceWorker.ready.catch(() => {});

    let existing = await navigator.serviceWorker.getRegistration('/');
    const scriptIsFcm = (reg) => {
        const u = reg?.active?.scriptURL || reg?.waiting?.scriptURL || '';
        return u.includes('firebase-messaging-sw.js');
    };

    // Another worker on scope `/` (e.g. old sw) blocks FCM — unregister then register messaging SW.
    if (existing && !scriptIsFcm(existing)) {
        try {
            await existing.unregister();
        } catch {
            /* ignore */
        }
        existing = await navigator.serviceWorker.getRegistration('/');
    }

    if (existing && scriptIsFcm(existing)) {
        try {
            await existing.update();
        } catch {
            /* ignore */
        }
        await waitForServiceWorkerActive(existing);
        return existing;
    }

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    try {
        await reg.update();
    } catch {
        /* ignore */
    }
    await waitForServiceWorkerActive(reg);
    return reg;
}

/**
 * Request notification permission, get FCM token, and save it to Firestore.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
export async function initNotifications(uid) {
    if (!uid) return null;
    try {
        if (!isIosWebPushSupportedVersion()) {
            console.warn('[FCM] iOS 16.4+ required for web push on iPhone.');
            return null;
        }

        // Do not block getToken on standalone detection — some WebKit builds mis-report; let FCM succeed or fail clearly.
        if (isIosDevice() && !isIosStandalonePwa()) {
            console.info('[FCM] iOS: Web Push works reliably from the Home Screen app; Safari tab may not receive a token.');
        }

        if (!VAPID_KEY || String(VAPID_KEY).trim() === '') {
            console.error('[FCM] Missing VITE_FIREBASE_VAPID_KEY — browser cannot obtain a push token.');
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        const messaging = getMsg();
        if (!messaging) return null;

        const reg = await getFcmServiceWorkerRegistration();
        if (!reg) return null;

        if (isIosDevice()) {
            await new Promise((r) => setTimeout(r, 400));
        }

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg,
        });

        if (token) {
            await saveFcmToken(uid, token);
            if (!_foregroundListenerAttached) {
                _foregroundListenerAttached = true;
                // Data-only FCM: foreground deliveries hit here only — do not call showNotification
                // (system banner off; user sees in-app notifications from Firestore).
                onMessage(messaging, () => {});
            }
        }

        return token || null;
    } catch (err) {
        console.warn('[FCM] initNotifications failed:', err.message);
        return null;
    }
}

export async function saveFcmToken(uid, token) {
    if (!uid || !token) return;
    const ref = doc(db, 'users', uid);
    try {
        await updateDoc(ref, {
            fcmTokens: arrayUnion(token),
        });
    } catch (err) {
        const code = err?.code || '';
        const msg = String(err?.message || '');
        if (code === 'not-found' || msg.includes('No document to update')) {
            try {
                await setDoc(ref, { fcmTokens: arrayUnion(token) }, { merge: true });
            } catch (e2) {
                console.warn('[FCM] saveFcmToken setDoc failed:', e2?.message || e2);
            }
        } else {
            console.warn('[FCM] saveFcmToken failed:', err.message);
        }
    }
}

export async function removeFcmToken(uid) {
    if (!uid) return;
    try {
        const messaging = getMsg();
        const reg = await getFcmServiceWorkerRegistration().catch(() => null);
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            ...(reg ? { serviceWorkerRegistration: reg } : {}),
        }).catch(() => null);
        if (token) {
            await deleteToken(messaging);
            await updateDoc(doc(db, 'users', uid), {
                fcmTokens: arrayRemove(token),
            });
        }
    } catch (err) {
        console.warn('[FCM] removeFcmToken failed:', err.message);
    }
}
