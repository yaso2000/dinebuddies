import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/**
 * @param {{ shieldType: string, paypalEmail: string }} args
 */
export async function requestCashout({ shieldType, paypalEmail }) {
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'requestCashout');
    const result = await fn({ shieldType, paypalEmail });
    return result?.data || null;
}

/**
 * Admin: mark paid or reject (refunds savings on reject).
 * @param {{ requestId: string, action: 'paid'|'reject', rejectReason?: string }} args
 */
export async function resolveCashoutRequest({ requestId, action, rejectReason }) {
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'resolveCashoutRequest');
    const result = await fn({ requestId, action, rejectReason });
    return result?.data || null;
}
