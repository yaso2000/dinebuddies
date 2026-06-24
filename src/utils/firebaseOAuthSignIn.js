import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '../firebase/config';
import { resetFirebaseRedirectBootstrap } from '../firebase/authBootstrap';
import { dismissFacebookSdkOverlay } from './facebookSdkCleanup';
import { clearFacebookIosLoginPending } from './facebookIosSignIn';
import {
    clearOAuthRedirectPending,
    clearGuestModeForSignIn,
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

/** Facebook redirect on mobile poisons Firebase auth — popup only, never redirect fallback. */
function shouldFallbackPopupToRedirect(popupErr, providerId) {
    if (providerId === 'facebook.com') return false;
    const code = popupErr?.code || '';
    return (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/unsupported-persistence-type'
    );
}

/** Clear stale redirect state before a fresh popup sign-in (user tapped a provider button). */
export function prepareOAuthSignInAttempt() {
    clearOAuthRedirectPending();
    clearFacebookIosLoginPending();
    resetFirebaseRedirectBootstrap();
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
        if (shouldFallbackPopupToRedirect(popupErr, providerId)) {
            return startOAuthRedirect(provider);
        }
        clearOAuthRedirectPending();
        resetFirebaseRedirectBootstrap();
        throw popupErr;
    }
}
