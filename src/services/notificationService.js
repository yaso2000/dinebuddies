/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * Usage:
 *   import { initNotifications, saveFcmToken, removeFcmToken } from './notificationService';
 *
 *   // After login:
 *   await initNotifications(currentUser.uid);
 *
 *   // Before logout:
 *   await removeFcmToken(currentUser.uid);
 */
import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import app from '../firebase/config';
import { db } from '../firebase/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
function getMsg() {
    if (_messaging) return _messaging;
    try {
        _messaging = getMessaging(app);
    } catch {
        _messaging = null;
    }
    return _messaging;
}

/**
 * True if our PWA worker (/sw.js) already controls the origin — registering
 * /firebase-messaging-sw.js with the same scope would replace it and can break
 * cached shells, routing, and the whole app after login.
 */
async function pwaServiceWorkerActive() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false;
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.some((reg) => {
            const url = reg.active?.scriptURL || '';
            return url.includes('/sw.js') && !url.includes('firebase-messaging-sw');
        });
    } catch {
        return false;
    }
}

/**
 * Request notification permission, get FCM token, and save it to Firestore.
 * Safe to call multiple times — idempotent.
 * @param {string} uid — current user's UID
 * @returns {Promise<string|null>} token if granted, null otherwise
 */
export async function initNotifications(uid) {
    if (!uid) return null;
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        const messaging = getMsg();
        if (!messaging) return null;

        // Do not register firebase-messaging-sw.js when /sw.js is already active — same scope would
        // replace the PWA worker and has caused blank/broken SPA loads after sign-in.
        if (await pwaServiceWorkerActive()) {
            return null;
        }

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.register(
                '/firebase-messaging-sw.js',
                { scope: '/' }
            ),
        });

        if (token) {
            await saveFcmToken(uid, token);
            // Handle foreground messages
            onMessage(messaging, (payload) => {
                const { title, body } = payload.notification || {};
                const { actionUrl } = payload.data || {};
                
                if (title && Notification.permission === 'granted') {
                    navigator.serviceWorker.ready.then((reg) => {
                        const iconUrl = payload.data?.senderAvatar || '/icon-light-192.png';
                        reg.showNotification(title, {
                            body: body || '',
                            icon: iconUrl,
                            data: { url: actionUrl || '/' }
                        });
                    });
                }
            });
        }

        return token || null;
    } catch (err) {
        // Permission denied or browser doesn't support push — fail silently
        console.warn('[FCM] initNotifications failed:', err.message);
        return null;
    }
}

/**
 * Save an FCM token to the user's Firestore document.
 * Uses arrayUnion so no duplicates are stored.
 */
export async function saveFcmToken(uid, token) {
    if (!uid || !token) return;
    try {
        await updateDoc(doc(db, 'users', uid), {
            fcmTokens: arrayUnion(token),
        });
    } catch (err) {
        console.warn('[FCM] saveFcmToken failed:', err.message);
    }
}

/**
 * Remove the current device's FCM token from Firestore and invalidate it.
 * Call before logout to stop receiving push notifications on this device.
 */
export async function removeFcmToken(uid) {
    if (!uid) return;
    try {
        const messaging = getMsg();
        const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
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
