import { getRedirectResult } from 'firebase/auth';
import { auth } from './config';

/** Single shared getRedirectResult — must run once before React mounts after OAuth redirect. */
let redirectResultPromise = null;

export function getFirebaseRedirectResultOnce() {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }
    if (!redirectResultPromise) {
        redirectResultPromise = (async () => {
            try {
                return await getRedirectResult(auth);
            } catch (err) {
                if (err?.code === 'auth/no-auth-event') return null;
                console.warn('[authBootstrap] getRedirectResult:', err?.code, err?.message);
                return null;
            }
        })();
    }
    return redirectResultPromise;
}
