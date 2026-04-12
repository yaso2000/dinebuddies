/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications when the app is closed or in background.
 * Place this file in /public so it is served from the root at /firebase-messaging-sw.js
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyAK3IC3LrrbBBcDahT3hGlhVQ6oHhf289g',
    authDomain: 'dinebuddies.firebaseapp.com',
    projectId: 'dinebuddies',
    storageBucket: 'dinebuddies.firebasestorage.app',
    messagingSenderId: '686703042572',
    appId: '1:686703042572:web:065789445262a44642ce29',
});

const messaging = firebase.messaging();

// Handle background messages (app in background or closed)
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM] Received background message (Native push is automated by Chrome):', payload);
    // FCM automatically displays a notification if the payload contains `notification: {}`
    // Do NOT manually call `self.registration.showNotification` here, otherwise it will duplicate pushes!
    // Click handling is automatically taken care of by the server's `webpush: { fcm_options: { link } }`.
});

// Click on notification — open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
