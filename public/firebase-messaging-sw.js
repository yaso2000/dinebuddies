/* eslint-disable no-undef */
/**
 * FCM service worker — no window, document, or localStorage (not available here).
 * Firebase compat 12.8.x (same major as package.json).
 * Background pushes: onBackgroundMessage → showNotification (data payload from Cloud Functions).
 */

importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

const CACHE_NAME = 'dinebuddies-v30-invite-access';
const SITE_ORIGIN = 'https://www.dinebuddies.com';
const DEFAULT_ICON = '/icon-light-192.png';

firebase.initializeApp({
    apiKey: 'AIzaSyAK3IC3LrrbBBcDahT3hGlhVQ6oHhf289g',
    authDomain: 'dinebuddies.firebaseapp.com',
    projectId: 'dinebuddies',
    storageBucket: 'dinebuddies.firebasestorage.app',
    messagingSenderId: '686703042572',
    appId: '1:686703042572:web:065789445262a44642ce29',
});

const messaging = firebase.messaging();

function resolveTargetUrl(data) {
    const d = data || {};
    const raw = d.url || d.actionUrl || d.link || '/';
    const s = String(raw).trim() || '/';
    if (/^https?:\/\//i.test(s)) {
        try {
            return new URL(s).href;
        } catch {
            return `${SITE_ORIGIN}/`;
        }
    }
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${SITE_ORIGIN}${path}`;
}

function notificationTagFromData(data) {
    const raw = data?.tag || data?.notifId || '';
    if (raw && String(raw).trim()) {
        const s = String(raw).trim();
        return s.startsWith('db-notif-') ? s : `db-notif-${s}`;
    }
    return 'db-push';
}

messaging.onBackgroundMessage((payload) => {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const title =
        String(data.title || payload?.notification?.title || 'DineBuddies').trim() || 'DineBuddies';
    const body = String(data.body || payload?.notification?.body || '').trim();
    const url = resolveTargetUrl(data);
    const icon = String(data.icon || DEFAULT_ICON).trim() || DEFAULT_ICON;
    const tag = notificationTagFromData(data);

    return self.registration.showNotification(title, {
        body,
        icon,
        badge: DEFAULT_ICON,
        tag,
        renotify: true,
        data: { ...data, url, actionUrl: url },
    });
});

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'DB_SW_PING') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                clientList.forEach((client) => {
                    try {
                        client.postMessage({ type: 'DB_SW_PONG', at: Date.now() });
                    } catch {
                        /* ignore */
                    }
                });
            })
        );
        return;
    }

    if (event.data.type !== 'DB_SW_SHOW_TEST') return;
    event.waitUntil(
        self.registration.showNotification('DineBuddies SW test', {
            body: 'Service worker can show notifications on this device.',
            tag: 'db-sw-self-test',
            icon: DEFAULT_ICON,
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = resolveTargetUrl(event.notification.data);
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return navigateTarget(client, targetUrl);
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
            return undefined;
        })
    );
});

function navigateTarget(client, absoluteUrl) {
    let path = absoluteUrl;
    try {
        const u = new URL(absoluteUrl);
        const site = new URL(SITE_ORIGIN);
        if (u.origin === site.origin || u.origin === self.location.origin) {
            path = u.pathname + u.search + u.hash;
        }
    } catch {
        /* keep absolute */
    }
    if (client.navigate) {
        try {
            return client.navigate(path);
        } catch {
            /* fall through */
        }
    }
    if (client.focus) return client.focus();
    return undefined;
}
