/**
 * Maps Firebase Auth and other error codes to user-friendly messages.
 * Used by ToastContext, AuthContext, and AuthPage.
 */

const AUTH_ERROR_MAP = {
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
    'auth/network-request-failed': 'Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'This email is already in use.',
    'auth/weak-password': 'Please choose a stronger password.',
    'auth/invalid-verification-code': 'Invalid or expired code. Request a new one.',
    'auth/invalid-phone-number': 'Please enter a valid phone number.',
    'auth/captcha-check-failed': 'Verification failed. Please try again.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    'auth/account-exists-with-different-credential': 'An account already exists with the same email.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/configuration-not-found': 'Sign-in configuration error. Please try again.'
};

const FALLBACK = 'Something went wrong. Please try again.';

/**
 * @param {Error & { code?: string }} error - Firebase Auth or similar error
 * @returns {string} User-friendly message, or empty string for silent errors (e.g. popup closed)
 */
export function getAuthErrorMessage(error) {
    if (!error?.code) return FALLBACK;
    const msg = AUTH_ERROR_MAP[error.code];
    return msg ?? FALLBACK;
}
