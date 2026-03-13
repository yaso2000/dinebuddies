import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
export const db = getFirestore(app);
export const storage = getStorage(app);

// Make RecaptchaVerifier available globally for phone auth
if (typeof window !== 'undefined') {
    window.RecaptchaVerifier = RecaptchaVerifier;
}

export default app;
