import { GoogleAuthProvider } from 'firebase/auth';

/**
 * Google OAuth for Firebase Auth. Uses the Web client linked in Firebase Console only.
 * Do not pass client_id via setCustomParameters — mismatched IDs cause auth/argument-error.
 */
export function createGoogleAuthProvider() {
    return new GoogleAuthProvider();
}
