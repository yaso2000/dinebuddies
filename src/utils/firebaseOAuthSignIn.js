import { onAuthStateChanged, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '../firebase/config';
import { resetFirebaseRedirectBootstrap } from '../firebase/authBootstrap';
import { dismissFacebookSdkOverlay } from './facebookSdkCleanup';
import { clearFacebookIosLoginPending } from './facebookIosSignIn';
import {
    clearOAuthRedirectPending,
    clearGuestModeForSignIn,
    isIosTouchDevice,
    isStandalonePwa,
    markOAuthRedirectPending,
    preferOAuthRedirectForProvider,
} from './localDevAuth';

function resolveOAuthProviderId(provider) {
    if (!provider) return '';
    if (typeof provider.providerId === 'string' && provider.providerId) {
        return provider.providerId;
    }
    const fromClass = provider.constructor?.PROVIDER_ID;
    return typeof fromClass === 'string' ? fromClass : '';
}

/** Apple/Facebook/mobile: popup only — redirect + firebaseapp.com authDomain fails on www. */
function shouldFallbackPopupToRedirect(popupErr, providerId) {
    if (providerId === 'facebook.com' || providerId === 'apple.com') return false;
    if (isIosTouchDevice() || isStandalonePwa()) return false;
    const code = popupErr?.code || '';
    const message = String(popupErr?.message || '');
    return (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/unsupported-persistence-type' ||
        /Cross-Origin-Opener-Policy|window\.closed|popup/i.test(message)
    );
}

function isCoopPopupNoise(err) {
    const code = err?.code || '';
    const message = String(err?.message || '');
    return (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        /Cross-Origin-Opener-Policy|window\.closed|popup/i.test(message)
    );
}

/** COOP can make signInWithPopup reject even when Firebase already signed the user in. */
function waitForPopupAuthUser(timeoutMs = 5000) {
    return new Promise((resolve) => {
        let unsub = () => {};
        const finish = (user) => {
            clearTimeout(timer);
            unsub();
            resolve(user);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        void auth.authStateReady().then(() => {
            if (auth.currentUser) {
                finish(auth.currentUser);
                return;
            }
            unsub = onAuthStateChanged(auth, (user) => {
                if (user) finish(user);
            });
        });
    });
}

/** Clear stale redirect state before a fresh popup sign-in (user tapped a provider button). */
export function prepareOAuthSignInAttempt() {
    clearOAuthRedirectPending();
    clearFacebookIosLoginPending();
    resetFirebaseRedirectBootstrap({ force: true });
    dismissFacebookSdkOverlay();
}

async function startOAuthRedirect(provider) {
    const providerId = resolveOAuthProviderId(provider);
    markOAuthRedirectPending(providerId);
    try {
        await signInWithRedirect(auth, provider);
    } catch (redirectErr) {
        clearOAuthRedirectPending();
        throw redirectErr;
    }
    return { __oauthRedirect: true };
}

/**
 * iOS/Safari → redirect. Android/desktop → popup (redirect only when popup is blocked).
 * @returns {Promise<{ __oauthRedirect: true } | { result: import('firebase/auth').UserCredential }>}
 */
export async function firebaseOAuthPopupOrRedirect(provider) {
    if (!resolveOAuthProviderId(provider)) {
        const err = new Error('OAuth provider is required');
        err.code = 'auth/invalid-oauth-provider';
        throw err;
    }

    prepareOAuthSignInAttempt();
    clearGuestModeForSignIn();
    await auth.authStateReady();

    const providerId = resolveOAuthProviderId(provider);
    if (preferOAuthRedirectForProvider(providerId)) {
        return startOAuthRedirect(provider);
    }

    try {
        const result = await signInWithPopup(auth, provider);
        return { result };
    } catch (popupErr) {
        if (
            (providerId === 'apple.com' || providerId === 'google.com') &&
            isCoopPopupNoise(popupErr)
        ) {
            const recoveredUser = await waitForPopupAuthUser();
            if (recoveredUser) {
                return { result: { user: recoveredUser, providerId } };
            }
        }
        if (shouldFallbackPopupToRedirect(popupErr, providerId)) {
            return startOAuthRedirect(provider);
        }
        clearOAuthRedirectPending();
        resetFirebaseRedirectBootstrap({ force: true });
        throw popupErr;
    }
}
