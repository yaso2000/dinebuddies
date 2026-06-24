import { initializeApp } from 'firebase/app';

import { getAuth } from 'firebase/auth';

import { initializeFirestore } from 'firebase/firestore';

import { getStorage } from 'firebase/storage';

import { getDatabase } from 'firebase/database';

import { getMessaging, isSupported } from 'firebase/messaging';



const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies';



/** Apple Return URL: {project}.firebaseapp.com/__/auth/handler — do not use www.* here. */

const firebaseAuthDomain = `${firebaseProjectId}.firebaseapp.com`;



const firebaseConfig = {

    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

    authDomain: firebaseAuthDomain,

    projectId: firebaseProjectId,

    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

    appId: import.meta.env.VITE_FIREBASE_APP_ID,

};



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

export const auth = getAuth(app);

export const db = initializeFirestore(app, {

    experimentalAutoDetectLongPolling: true,

});

export const storage = getStorage(app);

export const rtdb = getDatabase(app);



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

