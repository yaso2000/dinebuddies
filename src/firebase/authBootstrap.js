import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth } from './config';
import {
    clearOAuthRedirectPending,
    hasFirebaseAuthReturnInUrl,
    isEmbeddedPreviewBrowser,
    isIosTouchDevice,
    peekOAuthRedirectPending,
    peekOAuthRedirectProvider,
    stashOAuthRedirectError,
} from '../utils/localDevAuth';
import { shouldRunOAuthRedirectBootstrap } from '../utils/oauthRedirectState';

/** Single shared getRedirectResult — must run once before React mounts after OAuth redirect. */
let redirectResultPromise = null;

export function resetFirebaseRedirectBootstrap() {
    redirectResultPromise = null;
}

function oauthRedirectLostMessage() {
    if (isEmbeddedPreviewBrowser()) {
        return 'Cursor preview cannot finish sign-in. Open https://www.dinebuddies.com/login in Safari on your iPhone.';
    }
    if (isIosTouchDevice()) {
        return 'Sign-in did not complete. Open https://www.dinebuddies.com/login in Safari (not WhatsApp or Instagram).';
    }
    return 'Sign-in redirect did not complete. Try again in Safari or Chrome.';
}

function waitForAuthUser(timeoutMs = 2800) {
    if (auth.currentUser) {
        return Promise.resolve(auth.currentUser);
    }
    return new Promise((resolve) => {
        let unsub = () => {};
        const timer = setTimeout(() => {
            unsub();
            resolve(null);
        }, timeoutMs);
        unsub = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            clearTimeout(timer);
            unsub();
            resolve(user);
        });
    });
}

export function getFirebaseRedirectResultOnce() {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }
    if (!redirectResultPromise) {
        redirectResultPromise = (async () => {
            if (!shouldRunOAuthRedirectBootstrap()) {
                return null;
            }

            const pendingRedirect = peekOAuthRedirectPending();
            const authReturnUrl = hasFirebaseAuthReturnInUrl();
            const stashedProvider = peekOAuthRedirectProvider();
            const recoveryTimeout =
                authReturnUrl || pendingRedirect || stashedProvider
                    ? stashedProvider === 'apple.com' && isIosTouchDevice()
                        ? 30000
                        : 20000
                    : 5000;

            try {
                // iOS: getRedirectResult must run before authStateReady or the redirect event is lost.
                if (isIosTouchDevice()) {
                    await new Promise((r) => setTimeout(r, 200));
                }

                let result = await getRedirectResult(auth);

                await auth.authStateReady();

                if (isIosTouchDevice() && !result?.user && (authReturnUrl || pendingRedirect || stashedProvider)) {
                    await new Promise((r) => setTimeout(r, 1500));
                    if (!result?.user && auth.currentUser) {
                        result = {
                            user: auth.currentUser,
                            providerId:
                                auth.currentUser.providerData?.[0]?.providerId || stashedProvider || null,
                        };
                    }
                }

                if (result?.user) {
                    return result;
                }

                const recoveredUser = await waitForAuthUser(recoveryTimeout);
                if (recoveredUser) {
                    return {
                        user: recoveredUser,
                        providerId:
                            result?.providerId ||
                            recoveredUser.providerData?.[0]?.providerId ||
                            stashedProvider ||
                            null,
                    };
                }

                if (authReturnUrl || pendingRedirect || stashedProvider) {
                    const err = {
                        code: 'auth/embedded-oauth-redirect-lost',
                        message: oauthRedirectLostMessage(),
                    };
                    console.warn('[authBootstrap]', err.message);
                    stashOAuthRedirectError(err);
                }
                if (!authReturnUrl && !recoveredUser) {
                    clearOAuthRedirectPending();
                }
                return result;
            } catch (err) {
                const code = err?.code || '';
                if (code === 'auth/no-auth-event' || code === 'auth/argument-error') {
                    const recoveredUser = await waitForAuthUser(recoveryTimeout);
                    if (recoveredUser) {
                        return {
                            user: recoveredUser,
                            providerId:
                                recoveredUser.providerData?.[0]?.providerId || stashedProvider || null,
                        };
                    }
                    if (authReturnUrl || pendingRedirect || stashedProvider) {
                        stashOAuthRedirectError({
                            code: 'auth/embedded-oauth-redirect-lost',
                            message: oauthRedirectLostMessage(),
                        });
                    }
                    if (!authReturnUrl) {
                        clearOAuthRedirectPending();
                    }
                    return null;
                }
                console.warn('[authBootstrap] getRedirectResult:', code, err?.message);
                stashOAuthRedirectError(err);
                if (!hasFirebaseAuthReturnInUrl()) {
                    clearOAuthRedirectPending();
                }
                return null;
            }
        })();
    }
    return redirectResultPromise;
}
