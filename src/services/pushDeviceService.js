import app, { auth } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'us-central1');

export async function registerFcmDeviceTokenOnServer(token) {
    if (!token) return { ok: false, reason: 'no_token' };
    if (!auth.currentUser?.uid) {
        return { ok: false, reason: 'unauthenticated' };
    }
    const fn = httpsCallable(functions, 'registerFcmDeviceToken');
    try {
        const result = await fn({ token });
        return result?.data || { ok: false };
    } catch (err) {
        const code = err?.code || '';
        if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
            return { ok: false, reason: 'unauthenticated' };
        }
        throw err;
    }
}

export async function sendTestPushToMe() {
    if (!auth.currentUser?.uid) {
        return { ok: false, reason: 'unauthenticated' };
    }
    const fn = httpsCallable(functions, 'sendTestPushToMe');
    const result = await fn({});
    return result?.data || { ok: false };
}
