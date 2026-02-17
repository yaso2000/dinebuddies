/* Simple Service Worker for PWA Installation Criteria */
self.addEventListener('fetch', (event) => {
    // Basic fetch handler required for PWA installability criteria
    // This doesn't actually cache anything, but satisfies the browser requirement
    return;
});
