import {
    signInWithPhoneNumber,
    RecaptchaVerifier,
    signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';

export const BUSINESS_PHONE_RECAPTCHA_ID = 'business-phone-recaptcha';

/** @type {RecaptchaVerifier | null} */
let recaptchaVerifier = null;

export function clearBusinessPhoneRecaptcha() {
    if (recaptchaVerifier) {
        try {
            recaptchaVerifier.clear();
        } catch {
            /* ignore */
        }
        recaptchaVerifier = null;
    }
}

/**
 * @param {string} [containerId]
 * @returns {RecaptchaVerifier}
 */
export function createBusinessPhoneRecaptcha(containerId = BUSINESS_PHONE_RECAPTCHA_ID) {
    clearBusinessPhoneRecaptcha();
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
    });
    return recaptchaVerifier;
}

/**
 * @param {string} e164
 * @param {string} [containerId]
 */
export async function sendFirebaseBusinessPhoneOtp(e164, containerId = BUSINESS_PHONE_RECAPTCHA_ID) {
    await signOut(auth).catch(() => {});
    const verifier = createBusinessPhoneRecaptcha(containerId);
    const confirmationResult = await signInWithPhoneNumber(auth, e164, verifier);
    return confirmationResult;
}

/**
 * @param {import('firebase/auth').ConfirmationResult} confirmationResult
 * @param {string} code
 */
export async function confirmFirebaseBusinessPhoneOtp(confirmationResult, code) {
    const credential = await confirmationResult.confirm(String(code).trim());
    const idToken = await credential.user.getIdToken();
    return {
        user: credential.user,
        uid: credential.user.uid,
        idToken,
        phoneNumber: credential.user.phoneNumber || '',
    };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function firebasePhoneAuthErrorMessage(err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    const map = {
        'auth/invalid-phone-number': 'Invalid phone number',
        'auth/missing-phone-number': 'Enter a phone number',
        'auth/too-many-requests': 'Too many attempts. Try again later',
        'auth/captcha-check-failed': 'Security check failed. Refresh and try again',
        'auth/invalid-verification-code': 'Invalid verification code',
        'auth/code-expired': 'Code expired. Request a new one',
        'auth/quota-exceeded': 'SMS quota exceeded. Try again later',
        'auth/operation-not-allowed': 'Phone sign-in is disabled in Firebase Console',
    };
    if (map[code]) return map[code];
    if (err instanceof Error && err.message) return err.message;
    return 'Phone verification failed';
}
