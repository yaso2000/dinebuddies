import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase configuration from environment variables
// Create .env from .env.example and add your Firebase credentials
// NEVER commit .env or hardcode credentials
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate required config in development to catch missing .env early
if (import.meta.env.DEV) {
    const missing = Object.entries(firebaseConfig)
        .filter(([, v]) => !v || v === 'your-api-key-here' || v === 'your-project-id.firebaseapp.com')
        .map(([k]) => k);
    if (missing.length > 0) {
        console.error(
            'Firebase config missing. Copy .env.example to .env and add your credentials.\n' +
            'Missing or placeholder: ' + missing.join(', ')
        );
    }
}

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);
// Realtime Database — used for low-cost presence tracking (online/offline)
export const rtdb = getDatabase(app);
// Firebase Cloud Messaging — must not throw at import time (unsupported browser / non-HTTPS / etc.)
export let messaging = null;
if (typeof window !== 'undefined') {
    isSupported()
        .then((ok) => {
            if (!ok) return;
            try {
                messaging = getMessaging(app);
            } catch (e) {
                console.warn('[Firebase] getMessaging failed:', e?.message || e);
            }
        })
        .catch(() => {});
}

export default app;
