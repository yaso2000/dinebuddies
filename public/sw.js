// Minimal Service Worker - Forces unregistration and clears way for production
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.registration.unregister()
            .then(() => {
                console.log('🧹 Service Worker cleaned up safely.');
            })
    );
});
