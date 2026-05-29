import { getApps, initializeApp } from 'firebase/app';
import { getFirebaseAdminCertConfig } from './_firebaseAdmin.js';

/**
 * Ensures the Firebase client SDK default app exists for server-side Gemini calls.
 * Must run before importing `GeminiService`.
 */
export function ensureFirebaseClientApp() {
    if (getApps().length) {
        return getApps()[0];
    }

    let adminProjectId = '';
    try {
        adminProjectId = getFirebaseAdminCertConfig().projectId || '';
    } catch {
        /* optional — VITE_* may still be set */
    }

    const projectId =
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        adminProjectId;

    const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
        authDomain:
            process.env.VITE_FIREBASE_AUTH_DOMAIN ||
            process.env.FIREBASE_AUTH_DOMAIN ||
            (projectId ? `${projectId}.firebaseapp.com` : undefined),
        projectId,
        storageBucket:
            process.env.VITE_FIREBASE_STORAGE_BUCKET ||
            process.env.FIREBASE_STORAGE_BUCKET ||
            (projectId ? `${projectId}.appspot.com` : undefined),
        messagingSenderId:
            process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
        throw new Error(
            'Firebase client config is not configured for AI generation (set VITE_FIREBASE_* or FIREBASE_API_KEY on the server)',
        );
    }

    return initializeApp(firebaseConfig);
}
