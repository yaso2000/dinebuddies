import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'us-central1');

export async function registerFcmDeviceTokenOnServer(token) {
    if (!token) return { ok: false };
    const fn = httpsCallable(functions, 'registerFcmDeviceToken');
    const result = await fn({ token });
    return result?.data || { ok: false };
}

export async function sendTestPushToMe() {
    const fn = httpsCallable(functions, 'sendTestPushToMe');
    const result = await fn({});
    return result?.data || { ok: false };
}
