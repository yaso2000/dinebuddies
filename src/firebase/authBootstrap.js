import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth, getFirebaseOAuthHandlerUrl } from './config';
import {
    clearOAuthRedirectPending,
    hasFirebaseAuthReturnInUrl,
    isAndroidTouchDevice,
    isEmbeddedPreviewBrowser,
    isIosTouchDevice,
    isStandalonePwa,
    peekOAuthRedirectPending,
    peekOAuthRedirectProvider,
    stashOAuthRedirectError,
} from '../utils/localDevAuth';
import { shouldRunOAuthRedirectBootstrap } from '../utils/oauthRedirectState';

/** Single shared getRedirectResult — must run once before React mounts after OAuth redirect. */
let redirectResultPromise = null;

/** @param {{ force?: boolean }} [options] — force=true when user starts a new OAuth attempt (button tap). */
export function resetFirebaseRedirectBootstrap(options = {}) {
    const { force = false } = options;
    if (!force && shouldRunOAuthRedirectBootstrap()) {
        return;
    }
    redirectResultPromise = null;
}

function oauthRedirectLostMessage(stashedProvider) {
    if (stashedProvider === 'apple.com') {
        const handler = getFirebaseOAuthHandlerUrl();
        return `Apple sign-in did not complete. In Apple Developer → Services ID, add Return URL exactly: ${handler}`;
    }
    if (stashedProvider === 'google.com' && isAndroidTouchDevice()) {
        return 'Google sign-in did not complete. Open https://www.dinebuddies.com/login in Chrome (not WhatsApp or Instagram).';
    }
    if (stashedProvider === 'google.com') {
        return 'Google sign-in did not complete. Try again in Chrome or Safari.';
    }
    if (stashedProvider === 'facebook.com') {
        return 'Facebook sign-in did not complete. Open https://www.dinebuddies.com/login in Chrome or Safari.';
    }
    if (isEmbeddedPreviewBrowser()) {
        return 'Cursor preview cannot finish sign-in. Open https://www.dinebuddies.com/login in Chrome or Safari.';
    }
    if (isIosTouchDevice() || isStandalonePwa()) {
        return 'Sign-in did not complete. Open https://www.dinebuddies.com/login in Safari (not WhatsApp or Instagram).';
    }
    return 'Sign-in did not complete. Open https://www.dinebuddies.com/login in Chrome or Safari.';
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
            const redirectRecoveryActive = authReturnUrl || pendingRedirect || stashedProvider;
            const recoveryTimeout =
                redirectRecoveryActive
                    ? stashedProvider === 'apple.com'
                        ? 35000
                        : isIosTouchDevice()
                          ? 25000
                          : 20000
                    : 5000;

            try {
                // Let Firebase attach redirect state before consuming it (all platforms).
                if (redirectRecoveryActive) {
                    const bootDelay =
                        stashedProvider === 'apple.com' && isIosTouchDevice() ? 400 : isIosTouchDevice() ? 200 : 100;
                    await new Promise((r) => setTimeout(r, bootDelay));
                }

                let result = await getRedirectResult(auth);

                await auth.authStateReady();

                if (!result?.user && redirectRecoveryActive) {
                    const settleMs =
                        stashedProvider === 'apple.com' && isIosTouchDevice() ? 2500 : isIosTouchDevice() ? 1500 : 800;
                    await new Promise((r) => setTimeout(r, settleMs));
                    if (!result?.user && auth.currentUser) {
                        const linked =
                            auth.currentUser.providerData?.find((p) => p?.providerId)?.providerId ||
                            stashedProvider ||
                            null;
                        result = {
                            user: auth.currentUser,
                            providerId: linked,
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

                if (redirectRecoveryActive) {
                    const err = {
                        code:
                            stashedProvider === 'apple.com'
                                ? 'auth/apple-config-mismatch'
                                : 'auth/embedded-oauth-redirect-lost',
                        message: oauthRedirectLostMessage(stashedProvider),
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
                    if (redirectRecoveryActive) {
                        stashOAuthRedirectError({
                            code:
                                stashedProvider === 'apple.com'
                                    ? 'auth/apple-config-mismatch'
                                    : 'auth/embedded-oauth-redirect-lost',
                            message: oauthRedirectLostMessage(stashedProvider),
                        });
                    }
                    if (!authReturnUrl && !recoveredUser) {
                        clearOAuthRedirectPending();
                    }
                    return null;
                }
                console.warn('[authBootstrap] getRedirectResult:', code, err?.message);
                if (
                    stashedProvider === 'apple.com' &&
                    (code === 'auth/internal-error' ||
                        code === 'auth/invalid-credential' ||
                        code === 'auth/unauthorized-domain')
                ) {
                    stashOAuthRedirectError({
                        code: 'auth/apple-config-mismatch',
                        message: oauthRedirectLostMessage('apple.com'),
                    });
                } else {
                    stashOAuthRedirectError(err);
                }
                if (!hasFirebaseAuthReturnInUrl()) {
                    clearOAuthRedirectPending();
                }
                return null;
            }
        })();
    }
    return redirectResultPromise;
}
