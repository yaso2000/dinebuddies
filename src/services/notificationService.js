/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * One worker: /firebase-messaging-sw.js (PWA precache + messaging). Do not register /sw.js.
 */
import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import app from '../firebase/config';
import { db } from '../firebase/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
let _foregroundListenerAttached = false;

/** iPhone / iPod touch / iPad (incl. iPadOS “desktop” UA as MacIntel + touch). */
export function isIOS() {
    if (typeof navigator === 'undefined') return false;
    return (
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
}

/** @deprecated use isIOS — kept for existing imports */
export function isIosDevice() {
    return isIOS();
}

/** Installed PWA / “Add to Home Screen” launch (not a Safari tab). */
export function isStandalonePwa() {
    if (typeof window === 'undefined') return false;
    let matchMediaStandalone = false;
    try {
        matchMediaStandalone = window.matchMedia('(display-mode: standalone)').matches;
    } catch {
        /* ignore */
    }
    console.log('[StandaloneCheck]', {
        matchMedia: matchMediaStandalone,
        navigatorStandalone: window.navigator.standalone,
    });
    return matchMediaStandalone || window.navigator.standalone === true;
}

/** iOS device launched from Home Screen — required before Web Push + permission on iOS. */
export function isIosStandalonePwa() {
    return isIOS() && isStandalonePwa();
}

/** Snapshot for iOS/PWA debugging (temporary). */
export function getPushCapabilitySnapshot(uid) {
    return {
        uid: uid ?? null,
        isIOS: isIOS(),
        isStandalone: isStandalonePwa(),
        supportsNotification: typeof Notification !== 'undefined',
        supportsServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        supportsPush: typeof window !== 'undefined' && 'PushManager' in window,
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable',
    };
}

/** iOS 16.4+ only — earlier versions cannot receive web push. */
export function isIosWebPushSupportedVersion() {
    if (!isIOS()) return true;
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

/** User preference: push enabled in Firestore (default true when unset). */
export async function isPushEnabledInPrefs(uid) {
    if (!uid) return false;
    try {
        const snap = await getDoc(doc(db, 'users', uid, 'preferences', 'notifications'));
        if (!snap.exists()) return true;
        return snap.data().pushEnabled !== false;
    } catch {
        return true;
    }
}

/**
 * Refresh FCM token when permission is already granted (app resume, return visit).
 * Does not show the browser permission prompt.
 */
export async function ensurePushRegistration(uid) {
    return registerFcmToken(uid, { requestPermission: false });
}

/**
 * Request permission if needed, obtain FCM token, save to Firestore.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
export async function initNotifications(uid) {
    return registerFcmToken(uid, { requestPermission: true });
}

async function registerFcmToken(uid, { requestPermission = false } = {}) {
    if (!uid) return null;
    try {
        const supported = await isSupported().catch(() => false);
        if (!supported) return null;

        if (!isIosWebPushSupportedVersion()) return null;

        if (isIOS() && !isStandalonePwa()) return null;

        if (!VAPID_KEY || String(VAPID_KEY).trim() === '') {
            console.error('[FCM] Missing VITE_FIREBASE_VAPID_KEY');
            return null;
        }

        if (typeof Notification === 'undefined') return null;

        let permission = Notification.permission;
        if (permission === 'denied') return null;

        if (permission !== 'granted') {
            if (!requestPermission) return null;
            permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;
        }

        const messaging = getMsg();
        if (!messaging) return null;

        const reg = await getFcmServiceWorkerRegistration();
        if (!reg) return null;

        if (isIOS()) {
            await new Promise((r) => setTimeout(r, 400));
        }

        let token = null;
        let lastTokenErr = null;
        for (let attempt = 0; attempt < 4 && !token; attempt += 1) {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 500 * attempt));
            }
            try {
                token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: reg,
                });
            } catch (err) {
                lastTokenErr = err;
                console.warn('[FCM] getToken attempt', attempt + 1, err?.code || '', err?.message || err);
            }
        }
        if (!token) {
            if (lastTokenErr) {
                console.warn('[FCM] getToken failed:', lastTokenErr?.code || '', lastTokenErr?.message || lastTokenErr);
            }
            return null;
        }

        await saveFcmToken(uid, token);

        if (!_foregroundListenerAttached) {
            _foregroundListenerAttached = true;
            onMessage(messaging, () => {});
        }

        return token;
    } catch (err) {
        console.warn('[FCM] registerFcmToken failed:', err?.message || err);
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
    if (isIOS() && !isStandalonePwa()) return;
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
