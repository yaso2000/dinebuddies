// DineBuddies Service Worker — installability only (PWA). No fetch interception:
// intercepting requests caused blank pages / 503 responses until hard refresh.

const CACHE_NAME = 'dinebuddies-v6';

const PRECACHE = ['/manifest.json', '/icon-light-192.png', '/icon-light-512.png'];

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

// Intentionally no "fetch" handler — let the browser handle all network requests.
