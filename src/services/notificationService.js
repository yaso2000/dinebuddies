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

/** Avoid hung promises freezing the UI (common on iOS PWA + FCM). */
function withTimeout(ms, promise, label = 'operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
    ]);
}

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
    return matchMediaStandalone || window.navigator.standalone === true;
}

/** iOS device launched from Home Screen — required before Web Push + permission on iOS. */
export function isIosStandalonePwa() {
    return isIOS() && isStandalonePwa();
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

    await withTimeout(10000, navigator.serviceWorker.ready.catch(() => {}), 'serviceWorker.ready').catch(() => {});

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

    let reg;
    try {
        reg = await withTimeout(
            20000,
            navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }),
            'serviceWorker.register(fcm)'
        );
    } catch {
        return null;
    }
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

        if (isIOS() && !isStandalonePwa()) {
            return null;
        }

        if (!VAPID_KEY || String(VAPID_KEY).trim() === '') {
            console.error('[FCM] Missing VITE_FIREBASE_VAPID_KEY — browser cannot obtain a push token.');
            return null;
        }

        /**
         * Start the permission prompt before any `await` so iOS keeps the user-activation chain
         * (same as SW registration — WebKit is strict).
         */
        let permissionPromise = null;
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try {
                permissionPromise = Notification.requestPermission();
            } catch (e) {
                console.warn('[FCM] requestPermission threw:', e?.message || e);
            }
        }

        const supported = await isSupported().catch(() => false);
        if (!supported) {
            console.warn('[FCM] Messaging unsupported here (HTTPS + supported browser required).');
            if (permissionPromise) {
                try {
                    await withTimeout(120000, permissionPromise, 'Notification.requestPermission(cleanup)');
                } catch {
                    /* ignore */
                }
            }
            return null;
        }

        const messaging = getMsg();
        if (!messaging) {
            if (permissionPromise) {
                try {
                    await withTimeout(120000, permissionPromise, 'Notification.requestPermission(cleanup)');
                } catch {
                    /* ignore */
                }
            }
            return null;
        }

        const reg = await getFcmServiceWorkerRegistration();
        if (!reg) {
            if (permissionPromise) {
                permissionPromise.catch(() => {});
                try {
                    await withTimeout(120000, permissionPromise, 'Notification.requestPermission(cancel)');
                } catch {
                    /* ignore */
                }
            }
            return null;
        }

        let permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
        if (permissionPromise) {
            try {
                permission = await withTimeout(120000, permissionPromise, 'Notification.requestPermission');
            } catch (e) {
                console.warn('[FCM] permission wait failed:', e?.message || e);
                permission = 'denied';
            }
        }
        if (permission !== 'granted') return null;

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
                token = await withTimeout(
                    25000,
                    getToken(messaging, {
                        vapidKey: VAPID_KEY,
                        serviceWorkerRegistration: reg,
                    }),
                    'FCM.getToken'
                );
            } catch (err) {
                lastTokenErr = err;
                console.warn('[FCM] getToken attempt', attempt + 1, err?.code || '', err?.message || err);
            }
        }
        if (!token && lastTokenErr) {
            console.warn('[FCM] getToken failed after retries:', lastTokenErr?.code || '', lastTokenErr?.message || lastTokenErr);
        }
        if (!token) return null;

        await saveFcmToken(uid, token);

        if (!_foregroundListenerAttached) {
            _foregroundListenerAttached = true;
            // Data-only FCM: foreground deliveries hit here only — do not call showNotification
            // (system banner off; user sees in-app notifications from Firestore).
            onMessage(messaging, () => {});
        }

        return token || null;
    } catch (err) {
        const code = err?.code != null ? String(err.code) : '';
        const msg = err?.message != null ? String(err.message) : String(err);
        console.warn('[FCM] initNotifications failed:', code ? `${code} ` : '', msg);
        return null;
    }
}

/**
 * Re-run FCM registration when the app returns to the foreground (iOS PWA often needs this).
 * Skips when the user turned push off in app preferences or the OS denied permission.
 * @param {string} uid
 */
export async function refreshFcmIfUserOptedIn(uid) {
    if (!uid) return;
    try {
        const snap = await getDoc(doc(db, 'users', uid, 'preferences', 'notifications'));
        let pushEnabled = true;
        if (snap.exists()) {
            const d = snap.data();
            if (typeof d?.pushEnabled === 'boolean') pushEnabled = d.pushEnabled;
        }
        if (!pushEnabled) return;
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        await initNotifications(uid);
    } catch (e) {
        console.warn('[FCM] refreshFcmIfUserOptedIn:', e?.message || e);
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
        if (!messaging) return;
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
