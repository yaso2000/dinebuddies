import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/** Must match Cloud Functions region (see Firebase deploy logs: us-central1). */
const functionsRegion = 'us-central1';
const functionsInstance = getFunctions(app, functionsRegion);

/**
 * Human-readable message for Firebase callable failures.
 */
export function verificationEmailErrorMessage(err, fallback = 'Could not send verification email.') {
    if (!err) return fallback;
    const msg = typeof err.message === 'string' ? err.message.trim() : '';
    if (msg) return msg;
    return fallback;
}

/**
 * Sends verification email via Resend (Cloud Function + HTML template).
 * Replaces Firebase client `sendEmailVerification` for better deliverability and design.
 *
 * @param {'business_signup'|'business_login'|'settings_email'|'pro_settings'|'affiliate_signup'|'home'} flow — matches continue URL after verify
 */
export async function sendVerificationEmailResend(flow = 'home') {
    const run = httpsCallable(functionsInstance, 'sendEmailVerificationResend');
    const result = await run({ flow });
    return result.data;
}
