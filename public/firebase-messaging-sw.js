/* eslint-disable no-undef */
/**
 * PWA precache + FCM.
 * Must use the **same major** Firebase JS version as the web app (package.json) so messaging stays compatible.
 * Server sends `webpush.notification` — the browser shows one system notification in background.
 * Do not add `onBackgroundMessage` + `showNotification` here (duplicates iOS banners).
 * Foreground: page `onMessage` swallows messages without calling `showNotification`.
 */

importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

const CACHE_NAME = 'dinebuddies-v19-sw-route-fix';
const PRECACHE = ['/manifest.json', '/icon-light-192.png', '/icon-light-512.png'];

firebase.initializeApp({
    apiKey: 'AIzaSyAK3IC3LrrbBBcDahT3hGlhVQ6oHhf289g',
    authDomain: 'dinebuddies.firebaseapp.com',
    projectId: 'dinebuddies',
    storageBucket: 'dinebuddies.firebasestorage.app',
    messagingSenderId: '686703042572',
    appId: '1:686703042572:web:065789445262a44642ce29',
});

firebase.messaging();

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
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

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const d = event.notification.data || {};
    const targetUrl =
        d.url ||
        d.actionUrl ||
        d.link ||
        (typeof d.FCM_MSG === 'object' && d.FCM_MSG?.data?.actionUrl) ||
        '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    try {
                        client.navigate(targetUrl);
                    } catch {
                        /* ignore */
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
