/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * One worker: /firebase-messaging-sw.js (PWA precache + messaging). Do not register /sw.js.
 */
import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
import {
    doc,
    getDoc,
    updateDoc,
    setDoc,
    arrayUnion,
    arrayRemove,
    collection,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import app from '../firebase/config';
import { db } from '../firebase/config';
import { persistPushEnabledPref } from './pushPrefs';
import { registerFcmDeviceTokenOnServer } from './pushDeviceService';
import {
    getLocalDeviceFcmToken,
    setLocalDeviceFcmToken,
    clearLocalFcmLinkedUid,
    waitForPushInfraReady,
    clearBootstrapCache,
} from './pushPersistence';
import { obtainFcmDeviceToken, ensureFcmServiceWorkerRegistered } from './fcmClient';

export { obtainFcmDeviceToken, ensureFcmServiceWorkerRegistered };

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
let _foregroundListenerAttached = false;
let _lastFcmError = null;

export function getLastFcmRegistrationError() {
    return _lastFcmError;
}

function setLastFcmError(err) {
    if (!err) {
        _lastFcmError = null;
        return;
    }
    _lastFcmError = normalizeFcmError(err);
}

export function normalizeFcmError(err) {
    if (!err) return { code: '', message: '' };
    return {
        code: err?.code || err?.name || '',
        message: String(err?.message || err),
    };
}

/** Format for toast / modal (includes Firebase messaging/* codes). */
export function formatPushRegistrationError(err) {
    const { code, message } = normalizeFcmError(err);
    if (code && message) return `${code}: ${message}`;
    return code || message || 'unknown';
}

/**
 * Persist iOS/PWA registration attempts for support (Firestore: users/{uid}/pushRegistrationLogs).
 */
export async function logPushRegistrationAttempt(uid, payload) {
    if (!uid) return;
    const entry = {
        step: String(payload?.step || 'unknown'),
        ok: payload?.ok === true,
        at: serverTimestamp(),
        code: payload?.code ? String(payload.code).slice(0, 120) : '',
        message: payload?.message ? String(payload.message).slice(0, 500) : '',
        reason: payload?.reason ? String(payload.reason).slice(0, 80) : '',
        snapshot: {
            ...getPushCapabilitySnapshot(uid),
            swController: Boolean(navigator.serviceWorker?.controller),
            swScript:
                navigator.serviceWorker?.controller?.scriptURL?.slice(-80) || '',
        },
        detail: payload?.detail && typeof payload.detail === 'object' ? payload.detail : null,
    };
    try {
        await addDoc(collection(db, 'users', uid, 'pushRegistrationLogs'), entry);
    } catch (e) {
        console.warn('[FCM] logPushRegistrationAttempt failed:', e?.message || e);
    }
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

    if (isIOS()) {
        if (window.navigator.standalone === true) return true;
        try {
            if (window.matchMedia('(display-mode: standalone)').matches) return true;
            if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
            if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
            // Safari tab is always `browser`; home-screen app is not.
            if (!window.matchMedia('(display-mode: browser)').matches) return true;
        } catch {
            /* ignore */
        }
        try {
            if (localStorage.getItem('dinebuddies_ios_pwa') === '1') return true;
        } catch {
            /* ignore */
        }
        return false;
    }

    try {
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
        if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    } catch {
        /* ignore */
    }
    return false;
}

/** Call once when we detect a reliable iOS home-screen launch (helps standalone detection). */
export function markIosPwaLaunch() {
    if (!isIOS() || typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem('dinebuddies_ios_pwa', '1');
    } catch {
        /* ignore */
    }
}

/** iOS device launched from Home Screen — required before Web Push + permission on iOS. */
export function isIosStandalonePwa() {
    return isIOS() && isStandalonePwa();
}

/** Snapshot for iOS/PWA debugging. */
export function getPushCapabilitySnapshot(uid) {
    return {
        uid: uid ?? null,
        isIOS: isIOS(),
        isStandalone: isStandalonePwa(),
        hasVapidKey: Boolean(VAPID_KEY && String(VAPID_KEY).trim()),
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

export function runWithTimeout(promise, timeoutMs, fallbackValue = null) {
    return Promise.race([
        promise,
        new Promise((resolve) => {
            setTimeout(() => resolve(fallbackValue), timeoutMs);
        }),
    ]);
}

function swReadyTimeoutMs() {
    return isIOS() ? 18000 : 12000;
}

/** @param {boolean} interactive — user is waiting (settings toggle) */
function tokenRegisterTimeoutMs(interactive = false, patient = false) {
    if (patient) return isIOS() ? 90000 : 45000;
    if (interactive) return isIOS() ? 45000 : 12000;
    return isIOS() ? 35000 : 18000;
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

/** iOS PWA: getToken needs an active controller, not only an activated worker. */
async function waitForServiceWorkerController(timeoutMs = 12000) {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false;
    if (navigator.serviceWorker.controller) return true;
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), timeoutMs);
        const onChange = () => {
            if (navigator.serviceWorker.controller) {
                clearTimeout(t);
                navigator.serviceWorker.removeEventListener('controllerchange', onChange);
                resolve(true);
            }
        };
        navigator.serviceWorker.addEventListener('controllerchange', onChange);
    });
}

/**
 * iOS PWA: getToken requires activated SW + page controller. Call from user-gesture registration only.
 */
export async function ensureServiceWorkerReadyForPush({ fromUserGesture = false } = {}) {
    const detail = {
        hasRegistration: false,
        activeState: '',
        scriptURL: '',
        hasController: false,
        ready: false,
        reloadScheduled: false,
    };

    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        return { registration: null, ready: false, detail, error: 'no_service_worker_api' };
    }

    let registration = await navigator.serviceWorker.getRegistration('/').catch(() => null);

    const scriptIsFcm = (reg) => {
        const u = reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || '';
        return u.includes('firebase-messaging-sw.js');
    };

    if (registration && !scriptIsFcm(registration)) {
        try {
            await registration.unregister();
        } catch {
            /* ignore */
        }
        registration = null;
    }

    if (!registration) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/',
        });
    }

    try {
        await registration.update();
    } catch {
        /* ignore */
    }

    detail.hasRegistration = true;
    await navigator.serviceWorker.ready.catch(() => {});
    await waitForServiceWorkerActive(registration, fromUserGesture ? 25000 : swReadyTimeoutMs());

    const worker = registration.active || registration.installing || registration.waiting;
    detail.activeState = worker?.state || '';
    detail.scriptURL = worker?.scriptURL || '';

    const controllerOk = await waitForServiceWorkerController(
        fromUserGesture ? 22000 : swReadyTimeoutMs()
    );
    detail.hasController = controllerOk || Boolean(navigator.serviceWorker.controller);

    if (isIOS() && !detail.hasController && fromUserGesture) {
        await new Promise((r) => setTimeout(r, 600));
        detail.hasController = Boolean(navigator.serviceWorker.controller);
    }

    if (isIOS() && !detail.hasController && fromUserGesture) {
        const reloaded = await maybeReloadForIosSwController();
        if (reloaded) {
            detail.reloadScheduled = true;
            return { registration, ready: false, detail, error: 'sw_reload_scheduled' };
        }
    }

    detail.ready =
        Boolean(registration?.active) &&
        detail.hasController &&
        scriptIsFcm(registration);

    return {
        registration: detail.ready ? registration : registration,
        ready: detail.ready,
        detail,
        error: detail.ready ? null : 'service_worker_not_ready',
    };
}

/**
 * Obtain FCM token — must run in the same async chain as a user tap on iOS.
 */
async function obtainFcmTokenFromGesture(registration) {
    const attempts = [];
    const messaging = getMsg();
    if (!messaging) {
        return { token: null, error: { code: 'messaging/unavailable', message: 'getMessaging failed' }, attempts };
    }
    if (!registration) {
        return { token: null, error: { code: 'messaging/sw-not-ready', message: 'No SW registration' }, attempts };
    }

    const max = isIOS() ? 10 : 5;
    let lastErr = null;

    for (let i = 0; i < max; i += 1) {
        if (i > 0) {
            await new Promise((r) => setTimeout(r, isIOS() ? 700 + i * 400 : 400 * i));
            if (isIOS() && i % 3 === 0) {
                try {
                    await registration.update();
                    await waitForServiceWorkerActive(registration, 8000);
                    await waitForServiceWorkerController(8000);
                } catch {
                    /* ignore */
                }
            }
        }
        try {
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration,
            });
            if (token && String(token).length >= 80) {
                attempts.push({ attempt: i + 1, ok: true });
                return { token, error: null, attempts };
            }
            lastErr = { code: 'messaging/empty-token', message: 'getToken returned empty' };
            attempts.push({ attempt: i + 1, ok: false, ...lastErr });
        } catch (err) {
            lastErr = normalizeFcmError(err);
            setLastFcmError(err);
            attempts.push({ attempt: i + 1, ok: false, ...lastErr });
            console.warn('[FCM] getToken', i + 1, lastErr.code, lastErr.message);
        }
    }

    return { token: null, error: lastErr, attempts };
}

/**
 * iOS-safe registration: call directly from onClick async handler (not void .then()).
 * Handles permission → SW ready → getToken → save → Firestore diagnostic logs.
 */
export async function registerPushDeviceFromUserGesture(uid, { requestPermissionIfNeeded = true } = {}) {
    if (!uid) {
        return { ok: false, reason: 'no_uid' };
    }

    setLastFcmError(null);
    const snap = getPushCapabilitySnapshot(uid);

    await logPushRegistrationAttempt(uid, {
        step: 'gesture_start',
        ok: true,
        detail: snap,
    });

    if (!isIosWebPushSupportedVersion()) {
        await logPushRegistrationAttempt(uid, {
            step: 'ios_version',
            ok: false,
            reason: 'ios_version_unsupported',
        });
        return { ok: false, reason: 'ios_version_unsupported' };
    }

    if (isIOS() && !isStandalonePwa()) {
        await logPushRegistrationAttempt(uid, {
            step: 'standalone',
            ok: false,
            reason: 'ios_needs_home_screen',
        });
        return { ok: false, reason: 'ios_needs_home_screen' };
    }

    if (!VAPID_KEY || String(VAPID_KEY).trim() === '') {
        await logPushRegistrationAttempt(uid, {
            step: 'vapid',
            ok: false,
            reason: 'missing_vapid',
        });
        return { ok: false, reason: 'missing_vapid' };
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
        await logPushRegistrationAttempt(uid, {
            step: 'isSupported',
            ok: false,
            reason: 'not_supported',
        });
        return { ok: false, reason: 'not_supported' };
    }

    if (typeof Notification === 'undefined') {
        await logPushRegistrationAttempt(uid, {
            step: 'notification_api',
            ok: false,
            reason: 'no_notification_api',
        });
        return { ok: false, reason: 'no_notification_api' };
    }

    try {
        if (Notification.permission !== 'granted') {
            if (!requestPermissionIfNeeded) {
                await logPushRegistrationAttempt(uid, {
                    step: 'permission',
                    ok: false,
                    reason: 'permission_denied',
                });
                return { ok: false, reason: 'permission_denied' };
            }
            const perm = await Notification.requestPermission();
            await logPushRegistrationAttempt(uid, {
                step: 'permission_request',
                ok: perm === 'granted',
                detail: { permission: perm },
            });
            if (perm !== 'granted') {
                return { ok: false, reason: 'permission_denied' };
            }
        }

        await persistPushEnabledPref(uid, true);

        const { token, error, registration } = await obtainFcmDeviceToken({ label: 'user-gesture' });
        await logPushRegistrationAttempt(uid, {
            step: 'get_token',
            ok: Boolean(token),
            code: error?.code || '',
            message: error?.message || '',
            detail: {
                script: registration?.active?.scriptURL?.slice(-64) || '',
                controller: Boolean(navigator.serviceWorker?.controller),
            },
        });

        if (!token) {
            return {
                ok: false,
                reason: 'token_failed',
                lastError: error || getLastFcmRegistrationError(),
            };
        }

        const saved = await saveFcmToken(uid, token);
        await logPushRegistrationAttempt(uid, {
            step: 'save_token',
            ok: saved,
            detail: { tokenLen: token.length },
        });

        if (!saved) {
            return {
                ok: false,
                reason: 'token_save_failed',
                lastError: getLastFcmRegistrationError(),
            };
        }

        attachForegroundMessageListener(getMsg());
        if (isIOS() && isStandalonePwa()) markIosPwaLaunch();

        const savedCount = await getSavedFcmTokenCount(uid);
        await logPushRegistrationAttempt(uid, {
            step: 'complete',
            ok: savedCount > 0,
            detail: { savedCount },
        });

        setLocalDeviceFcmToken(token, uid);
        return { ok: savedCount > 0, token, savedCount };
    } catch (err) {
        const norm = normalizeFcmError(err);
        setLastFcmError(err);
        await logPushRegistrationAttempt(uid, {
            step: 'exception',
            ok: false,
            code: norm.code,
            message: norm.message,
        });
        return { ok: false, reason: 'exception', lastError: norm };
    }
}

/**
 * Foreground FCM: never show OS banners — Firestore inbox + toasts handle UX.
 * Dispatches a custom event for optional listeners; SW posts FCM_PUSH_FOREGROUND when app is visible.
 */
export function attachForegroundMessageListener(messaging) {
    if (!messaging || _foregroundListenerAttached) return;
    _foregroundListenerAttached = true;

    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event?.data?.type !== 'FCM_PUSH_FOREGROUND') return;
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
                return;
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('db-fcm-foreground', { detail: event.data })
                );
            }
        });
    }

    onMessage(messaging, (payload) => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('db-fcm-foreground', { detail: payload }));
        }
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
        const u =
            reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || '';
        return u.includes('firebase-messaging-sw.js');
    };

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
        await waitForServiceWorkerActive(existing, swReadyTimeoutMs());
        if (isIOS()) {
            await waitForServiceWorkerController(swReadyTimeoutMs());
        }
        return existing;
    }

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    try {
        await reg.update();
    } catch {
        /* ignore */
    }
    await waitForServiceWorkerActive(reg, swReadyTimeoutMs());
    if (isIOS()) {
        await waitForServiceWorkerController(swReadyTimeoutMs());
    }
    return reg;
}

/**
 * Pre-register the FCM service worker (no permission prompt).
 * Call on app load for iOS PWA when permission is already granted — speeds up getToken.
 */
/** Prove iOS can show a banner from the active service worker (no FCM). */
export async function wakeFcmServiceWorker() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        return { ok: false, reason: 'no_service_worker' };
    }

    try {
        const registration = await ensureFcmServiceWorkerRegistered();
        try {
            await registration.update();
        } catch {
            /* ignore */
        }
        await navigator.serviceWorker.ready;

        const target = registration.active || navigator.serviceWorker.controller;
        if (target) {
            target.postMessage({ type: 'DB_SW_PING', at: Date.now() });
        }

        await waitForServiceWorkerController(isIOS() ? 12000 : 6000);

        console.info('[FCM] wakeFcmServiceWorker ok', {
            controller: Boolean(navigator.serviceWorker.controller),
            active: registration.active?.state,
        });
        return { ok: true, registration };
    } catch (err) {
        console.error('[FCM] wakeFcmServiceWorker failed:', err?.message || err);
        return { ok: false, reason: 'wake_failed', error: normalizeFcmError(err) };
    }
}

/**
 * After iOS sleep / screen lock the SW stops receiving pushes until woken.
 * Same steps as the local “Test service worker” button, plus getToken refresh.
 */
export async function revivePushDelivery(uid, { label = 'revive', showLocalTest = false } = {}) {
    if (!uid) {
        return { ok: false, reason: 'no_uid' };
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' };
    }
    if (isIOS() && !isStandalonePwa()) {
        return { ok: false, reason: 'ios_needs_home_screen' };
    }

    const wake = await wakeFcmServiceWorker();
    if (!wake.ok) {
        return { ok: false, reason: 'service_worker_wake_failed', lastError: wake.error };
    }

    if (isIOS()) {
        await new Promise((r) => setTimeout(r, 450));
    }

    const result = await registerAndSaveFcmToken(uid, { label });

    if (showLocalTest) {
        const test = await showServiceWorkerTestNotification();
        if (!test.ok && result.ok) {
            console.warn('[FCM] revivePushDelivery: local SW test failed after token refresh');
        }
    }

    return result;
}

export async function showServiceWorkerTestNotification() {
    const wake = await wakeFcmServiceWorker();
    if (!wake.ok) {
        return wake;
    }
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const target = reg?.active || navigator.serviceWorker.controller;
    if (!target) return { ok: false, reason: 'no_sw_controller' };
    target.postMessage({ type: 'DB_SW_SHOW_TEST' });
    return { ok: true };
}

export function warmupPushServiceWorker() {
    if (typeof window === 'undefined') return;
    if (isIOS() && !isStandalonePwa()) return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;
    void ensureFcmServiceWorkerRegistered().catch((err) => {
        console.warn('[FCM] warmupPushServiceWorker:', err?.message || err);
    });
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
 * Call synchronously as the first line of a click/tap handler (required on iOS for the system prompt).
 * @returns {Promise<NotificationPermission | 'unsupported'>}
 */
export function requestPushPermissionFromGesture() {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    try {
        return Notification.requestPermission();
    } catch (err) {
        console.warn('[FCM] requestPermission failed:', err?.message || err);
        return Promise.resolve('denied');
    }
}

/**
 * Register FCM after Notification.permission is already "granted".
 */
export async function completePushRegistrationAfterGrant(
    uid,
    { interactive = true, patient = false, fromGesture = false } = {}
) {
    // iOS and explicit user-waiting flows need the gesture-safe pipeline (permission → SW → getToken).
    if (isIOS() || patient || fromGesture) {
        return registerPushDeviceFromUserGesture(uid, {
            requestPermissionIfNeeded: interactive,
        });
    }
    if (interactive) {
        return registerPushDeviceFromUserGesture(uid, {
            requestPermissionIfNeeded: true,
        });
    }

    if (!uid) return { ok: false, reason: 'no_uid' };
    if (Notification.permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' };
    }

    await persistPushEnabledPref(uid, true);
    const token = await runWithTimeout(
        registerFcmTokenWithRetries(uid, { requestPermission: false, quick: true }),
        tokenRegisterTimeoutMs(false),
        null
    );

    if (token) {
        const savedCount = await getSavedFcmTokenCount(uid);
        return savedCount > 0
            ? { ok: true, token, savedCount }
            : { ok: false, reason: 'token_save_failed', lastError: getLastFcmRegistrationError() };
    }

    return { ok: false, reason: 'token_failed', lastError: getLastFcmRegistrationError() };
}


/**
 * Enable push (permission + registration). Prefer requestPushPermissionFromGesture() in the UI, then this.
 */
export async function enablePushNotifications(uid) {
    if (!uid) return { ok: false, reason: 'no_uid' };

    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        return { ok: false, reason: 'permission_denied' };
    }

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const permission = await requestPushPermission();
        if (permission !== 'granted') {
            return { ok: false, reason: 'permission_denied' };
        }
    }

    return completePushRegistrationAfterGrant(uid);
}

/**
 * Turn off push — saves preference immediately (never blocks UI).
 * Device token cleanup runs in the background with a short timeout.
 */
export async function disablePushNotifications(uid) {
    if (!uid) return;
    await persistPushEnabledPref(uid, false);
    void clearDevicePushRegistration(uid);
}

/** Remove only this device's token (do not wipe other devices' fcmTokens). */
export async function clearDevicePushRegistration(uid) {
    if (!uid) return;
    await runWithTimeout(revokeDeviceFcmToken(uid), 8000, null);
}

/**
 * Request iOS/browser permission — must run directly inside a click/tap handler.
 */
export async function requestPushPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
        return await Notification.requestPermission();
    } catch (err) {
        console.warn('[FCM] requestPermission failed:', err?.message || err);
        return 'denied';
    }
}

/** After prefs saved: register token without blocking (settings Save button). */
export function syncPushDeviceRegistration(uid, wantEnabled) {
    if (!uid) return;
    if (!wantEnabled) {
        void clearDevicePushRegistration(uid);
        return;
    }
    if (isIOS() && !isStandalonePwa()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void runWithTimeout(
        registerFcmTokenWithRetries(uid, { requestPermission: false, quick: true }),
        tokenRegisterTimeoutMs(false),
        null
    ).then((token) => {
        if (!token) void ensurePushRegistration(uid, { quick: false });
    });
}

/**
 * Refresh FCM token when permission is already granted (app resume, return visit).
 */
export async function ensurePushRegistration(uid, { quick = false } = {}) {
    if (!(await isPushEnabledInPrefs(uid))) return null;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return null;
    }
    return runWithTimeout(
        registerFcmTokenWithRetries(uid, {
            requestPermission: false,
            quick,
            maxAttempts: quick ? (isIOS() ? 3 : 2) : undefined,
        }),
        tokenRegisterTimeoutMs(quick),
        null
    );
}

/**
 * Request permission if needed, obtain FCM token, save to Firestore.
 * @returns {Promise<string|null>}
 */
export async function initNotifications(uid) {
    const result = await enablePushNotifications(uid);
    if (!result.ok) return null;
    return result.token || null;
}

async function registerFcmTokenWithRetries(uid, opts = {}) {
    const quick = opts.quick === true;
    const maxAttempts =
        opts.maxAttempts ?? (quick ? (isIOS() ? 4 : 3) : isIOS() ? 8 : 5);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const token = await registerFcmToken(uid, opts);
        if (token) return token;
        if (attempt < maxAttempts - 1) {
            const delayMs = quick
                ? 350 + attempt * 250
                : isIOS()
                  ? 900 + attempt * 500
                  : 450 * (attempt + 1);
            await new Promise((r) => setTimeout(r, delayMs));
            if (isIOS() && attempt > 0 && attempt % 3 === 0) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration('/');
                    await reg?.update();
                    await waitForServiceWorkerActive(reg, 6000);
                    await waitForServiceWorkerController(6000);
                } catch {
                    /* ignore */
                }
            }
        }
    }
    return null;
}

async function maybeReloadForIosSwController() {
    if (!isIOS() || navigator.serviceWorker?.controller) return false;
    try {
        if (sessionStorage.getItem('db_ios_sw_reload_once') === '1') return false;
        sessionStorage.setItem('db_ios_sw_reload_once', '1');
    } catch {
        return false;
    }
    window.location.reload();
    return true;
}

async function registerFcmToken(uid, { requestPermission = false, label = 'registerFcmToken' } = {}) {
    if (!uid) return null;
    try {
        if (!isIosWebPushSupportedVersion()) return null;
        if (isIOS() && !isStandalonePwa()) return null;

        if (typeof Notification === 'undefined') return null;

        if (Notification.permission === 'denied') return null;

        if (Notification.permission !== 'granted') {
            if (!requestPermission) return null;
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;
        }

        const { token, error } = await obtainFcmDeviceToken({ label });
        if (!token) {
            if (error) setLastFcmError(error);
            return null;
        }

        const saved = await saveFcmToken(uid, token);
        if (!saved) {
            setLastFcmError({ code: 'save_failed', message: 'Token obtained but not saved to server' });
            return null;
        }
        setLocalDeviceFcmToken(token, uid);
        if (isIOS() && isStandalonePwa()) markIosPwaLaunch();
        attachForegroundMessageListener(getMsg());

        return token;
    } catch (err) {
        setLastFcmError(err);
        console.error('[FCM] registerFcmToken failed:', err?.code || '', err?.message || err);
        return null;
    }
}

/**
 * Permission must already be granted (or will be requested by caller).
 * Registers token via serviceWorker.ready → getToken → Firestore.
 */
export async function registerAndSaveFcmToken(uid, { label = 'registerAndSave' } = {}) {
    if (!uid) {
        return { ok: false, reason: 'no_uid' };
    }
    if (!isIosWebPushSupportedVersion()) {
        return { ok: false, reason: 'ios_version_unsupported' };
    }
    if (isIOS() && !isStandalonePwa()) {
        return { ok: false, reason: 'ios_needs_home_screen' };
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' };
    }

    const { token, error } = await obtainFcmDeviceToken({ label });
    if (!token) {
        if (error) setLastFcmError(error);
        return { ok: false, reason: 'token_failed', lastError: error || getLastFcmRegistrationError() };
    }

    const saved = await saveFcmToken(uid, token);
    if (!saved) {
        return { ok: false, reason: 'token_save_failed', lastError: getLastFcmRegistrationError() };
    }

    setLocalDeviceFcmToken(token, uid);
    attachForegroundMessageListener(getMsg());
    const savedCount = await getSavedFcmTokenCount(uid);
    return { ok: savedCount > 0, token, savedCount };
}

export async function saveFcmToken(uid, token) {
    if (!uid || !token) return false;
    let saved = false;
    try {
        const server = await registerFcmDeviceTokenOnServer(token);
        if (server?.ok) saved = true;
    } catch (err) {
        setLastFcmError(err);
        console.warn('[FCM] registerFcmDeviceToken callable failed:', err?.message || err);
    }
    if (!saved) {
        const ref = doc(db, 'users', uid);
        try {
            await updateDoc(ref, {
                fcmTokens: arrayUnion(token),
            });
            saved = true;
        } catch (err) {
            const code = err?.code || '';
            const msg = String(err?.message || '');
            if (code === 'not-found' || msg.includes('No document to update')) {
                try {
                    await setDoc(ref, { fcmTokens: arrayUnion(token) }, { merge: true });
                    saved = true;
                } catch (e2) {
                    setLastFcmError(e2);
                    console.warn('[FCM] saveFcmToken setDoc failed:', e2?.message || e2);
                }
            } else {
                setLastFcmError(err);
                console.warn('[FCM] saveFcmToken failed:', err.message);
            }
        }
    }
    if (saved) {
        setLocalDeviceFcmToken(token, uid);
    }
    return saved;
}

/** Read how many device tokens are stored for this user (diagnostics). */
export async function getSavedFcmTokenCount(uid) {
    if (!uid) return 0;
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        const list = snap.exists() ? snap.data()?.fcmTokens || [] : [];
        return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))].length;
    } catch {
        return 0;
    }
}

export async function isFcmTokenOnServer(uid, token) {
    if (!uid || !token) return false;
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) return false;
        const list = snap.data()?.fcmTokens || [];
        const needle = String(token).trim();
        return list.some((t) => String(t).trim() === needle);
    } catch {
        return false;
    }
}

/**
 * Combined local + server registration state (avoids false "no token" on iOS cold start).
 */
export async function getDevicePushRegistrationStatus(uid) {
    const local = getLocalDeviceFcmToken();
    let serverCount = 0;
    let tokenOnServer = false;

    if (uid) {
        try {
            serverCount = await getSavedFcmTokenCount(uid);
            if (local?.token) {
                tokenOnServer = await isFcmTokenOnServer(uid, local.token);
            }
        } catch {
            /* ignore */
        }
    }

    const effectivelyRegistered =
        serverCount > 0 ||
        tokenOnServer ||
        Boolean(local?.token && local.linkedUid === uid);

    return {
        serverCount,
        localToken: local?.token || null,
        tokenOnServer,
        effectivelyRegistered,
    };
}

/** Read current device token from FCM without invalidating it. */
export async function peekCurrentFcmToken() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return null;
    }
    if (!VAPID_KEY) return getLocalDeviceFcmToken()?.token || null;
    try {
        const messaging = getMsg();
        if (!messaging) return getLocalDeviceFcmToken()?.token || null;
        const reg = await runWithTimeout(getFcmServiceWorkerRegistration(), 8000, null);
        const token = await runWithTimeout(
            getToken(messaging, {
                vapidKey: VAPID_KEY,
                ...(reg ? { serviceWorkerRegistration: reg } : {}),
            }),
            6000,
            null
        ).catch(() => null);
        if (token) setLocalDeviceFcmToken(token);
        return token || getLocalDeviceFcmToken()?.token || null;
    } catch {
        return getLocalDeviceFcmToken()?.token || null;
    }
}

/**
 * Logout: remove this device's token from the user doc only — keep local token for next login.
 */
export async function unlinkDeviceTokenFromUser(uid) {
    if (!uid) return;
    let token = getLocalDeviceFcmToken()?.token || null;
    if (!token) {
        token = await peekCurrentFcmToken();
    }
    if (token) {
        try {
            await updateDoc(doc(db, 'users', uid), {
                fcmTokens: arrayRemove(token),
            });
        } catch {
            /* ignore */
        }
        setLocalDeviceFcmToken(token, null);
        clearLocalFcmLinkedUid();
    }
}

/**
 * Silent session restore: re-link local token and/or refresh FCM without UI (returning users).
 */
export async function bootstrapPushSession(uid) {
    if (!uid) return { registered: false, reason: 'no_uid' };

    if (typeof Notification === 'undefined') {
        return { registered: false, reason: 'no_notification_api' };
    }

    if (Notification.permission !== 'granted') {
        return { registered: false, reason: 'permission_not_granted' };
    }

    if (isIOS() && !isStandalonePwa()) {
        return { registered: false, reason: 'ios_needs_home_screen' };
    }

    if (!(await isPushEnabledInPrefs(uid))) {
        return { registered: false, reason: 'prefs_disabled' };
    }

    warmupPushServiceWorker();
    if (isIOS() && isStandalonePwa()) markIosPwaLaunch();

    const result = await registerAndSaveFcmToken(uid, { label: 'bootstrap' });
    const status = await getDevicePushRegistrationStatus(uid);

    if (result.ok) {
        return { registered: true, source: 'getToken', status };
    }

    console.error('[FCM] bootstrapPushSession failed:', result.reason, result.lastError);
    return {
        registered: status.effectivelyRegistered,
        reason: status.effectivelyRegistered ? undefined : result.reason || 'no_token',
        status,
    };
}

const _bootstrapInflight = new Map();

/** Deduped bootstrap per uid — await before showing "Finish Push Setup". */
export function runPushBootstrap(uid) {
    if (!uid) return Promise.resolve({ registered: false, reason: 'no_uid' });
    const existing = _bootstrapInflight.get(uid);
    if (existing) return existing;

    const promise = bootstrapPushSession(uid).finally(() => {
        setTimeout(() => _bootstrapInflight.delete(uid), 3000);
    });
    _bootstrapInflight.set(uid, promise);
    return promise;
}

export async function runPushBootstrapWithRetries(uid, delaysMs = [0, 1200, 3000, 6000]) {
    let last = { registered: false, reason: 'no_token' };
    for (const delay of delaysMs) {
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
        }
        clearBootstrapCache(uid);
        last = await runPushBootstrap(uid);
        if (last.registered) return last;
    }
    return last;
}

export async function removeFcmToken(uid) {
    if (!uid) return;
    const canUseSw = !(isIOS() && !isStandalonePwa());
    if (!canUseSw) return;
    try {
        const messaging = getMsg();
        if (!messaging) return;

        const reg = await runWithTimeout(getFcmServiceWorkerRegistration(), 4000, null);
        const token = await runWithTimeout(
            getToken(messaging, {
                vapidKey: VAPID_KEY,
                ...(reg ? { serviceWorkerRegistration: reg } : {}),
            }),
            3000,
            null
        ).catch(() => null);

        if (token) {
            await updateDoc(doc(db, 'users', uid), {
                fcmTokens: arrayRemove(token),
            }).catch(() => {});
            setLocalDeviceFcmToken(token, null);
            clearLocalFcmLinkedUid();
        }
    } catch (err) {
        console.warn('[FCM] removeFcmToken failed:', err.message);
    }
}

/** Full device unregister (settings off) — removes from server and invalidates FCM token. */
export async function revokeDeviceFcmToken(uid) {
    if (!uid) return;
    const canUseSw = !(isIOS() && !isStandalonePwa());
    if (!canUseSw) return;
    try {
        const messaging = getMsg();
        if (!messaging) return;
        const reg = await runWithTimeout(getFcmServiceWorkerRegistration(), 4000, null);
        const token =
            getLocalDeviceFcmToken()?.token ||
            (await runWithTimeout(
                getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    ...(reg ? { serviceWorkerRegistration: reg } : {}),
                }),
                3000,
                null
            ).catch(() => null));
        if (token) {
            await deleteToken(messaging).catch(() => {});
            await updateDoc(doc(db, 'users', uid), {
                fcmTokens: arrayRemove(token),
            }).catch(() => {});
        }
    } catch (err) {
        console.warn('[FCM] revokeDeviceFcmToken failed:', err.message);
    }
}

/** Human-readable push blockers for settings UI. */
export function describePushBlocker(reason) {
    switch (reason) {
        case 'ios_needs_home_screen':
            return 'ios_needs_home_screen';
        case 'ios_version_unsupported':
            return 'ios_version_unsupported';
        case 'missing_vapid':
            return 'missing_vapid';
        case 'permission_denied':
            return 'permission_denied';
        case 'not_supported':
            return 'not_supported';
        case 'token_failed':
            return 'token_failed';
        case 'token_save_failed':
            return 'token_save_failed';
        case 'service_worker_not_ready':
            return 'service_worker_not_ready';
        default:
            return reason || 'unknown';
    }
}
