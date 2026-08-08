import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

const functionsInstance = getFunctions(app, 'us-central1');

/**
 * Sends password reset email via Resend (Cloud Function + HTML template).
 * Replaces Firebase client `sendPasswordResetEmail` for deliverability and design.
 */
export async function sendPasswordResetViaResend(email) {
    const run = httpsCallable(functionsInstance, 'sendPasswordResetEmailResend');
    const result = await run({ email: String(email || '').trim() });
    return result.data;
}
