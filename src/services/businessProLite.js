import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/**
 * Spend Dine Credits to activate (or extend) the credit "Pro Lite" business pass.
 * Server enforces the cost + sets/extends the 30-day window.
 */
export function activateBusinessProLiteWithCredits() {
    return httpsCallable(getFunctions(app, 'us-central1'), 'activateBusinessProLiteWithCredits')({}).then(
        (r) => r.data
    );
}
