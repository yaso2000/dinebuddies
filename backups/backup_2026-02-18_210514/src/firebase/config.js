import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
// IMPORTANT: Replace these with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > General > Your apps
const firebaseConfig = {
    apiKey: "AIzaSyAK3IC3LrrbBBcDahT3hGlhVQ6oHhf289g",
    authDomain: "dinebuddies.firebaseapp.com",
    projectId: "dinebuddies",
    storageBucket: "dinebuddies.firebasestorage.app",
    messagingSenderId: "686703042572",
    appId: "1:686703042572:web:065789445262a44642ce29"
};

// Initialize Firebase
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
