// Deprecated: PWA + FCM live in /firebase-messaging-sw.js (single worker, scope /).
// Kept so old caches can be replaced; do not register this file from the app.

const CACHE_NAME = 'dinebuddies-sw-deprecated';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});
