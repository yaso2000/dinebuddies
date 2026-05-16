/**
 * Maps Firebase Auth and other error codes to user-friendly messages.
 * Used by ToastContext and AuthContext.
 */

const AUTH_ERROR_MAP = {
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
    'auth/network-request-failed': 'Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'This account does not exist or the password is incorrect.',
    'auth/user-not-found': 'This account does not exist.',
    'auth/wrong-password': 'The password is incorrect. Please try again.',
    'auth/email-already-in-use': 'This email is already in use.',
    'auth/weak-password': 'Please choose a stronger password.',
    'auth/invalid-verification-code': 'Invalid or expired code. Request a new one.',
    'auth/invalid-phone-number': 'Please enter a valid phone number.',
    'auth/captcha-check-failed': 'Verification failed. Please try again.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    'auth/account-exists-with-different-credential': 'An account already exists with the same email.',
    'auth/business-email-in-use': 'This email is already registered as a business account. Use Business sign-in, not personal login.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/configuration-not-found': 'Sign-in configuration error. Please try again.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/affiliate-web-only':
        'Create your affiliate account from a desktop browser. On your phone, sign in via the app login → Business tab with your partner email and password.',
    // Firestore (e.g. profile write after sign-up)
    'permission-denied': 'Could not save your profile (access denied). Try again or contact support.',
    'unavailable': 'Service temporarily unavailable. Try again in a moment.',
    'failed-precondition': 'Request could not be completed. Please try again.'
};

const FALLBACK = 'Something went wrong. Please try again.';

/**
 * @param {Error & { code?: string }} error - Firebase Auth or similar error
 * @returns {string} User-friendly message, or empty string for silent errors (e.g. popup closed)
 */
export function getAuthErrorMessage(error) {
    const combined = `${error?.code || ''} ${error?.message || ''}`;
    // Google OAuth popup often returns redirect_uri_mismatch in message (not always a Firebase code)
    if (/redirect_uri_mismatch|invalid_client|OAuth 2 parameters/i.test(combined)) {
        return 'OAuth setup: add this page origin to Google Cloud (OAuth Web client → Authorized JavaScript origins), add firebaseapp.com/__/auth/handler redirect URIs, and add localhost to Firebase Auth → Authorized domains.';
    }
    if (!error?.code) return FALLBACK;
    const msg = AUTH_ERROR_MAP[error.code];
    return msg ?? FALLBACK;
}
