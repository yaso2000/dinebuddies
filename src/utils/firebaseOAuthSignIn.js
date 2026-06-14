import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
    clearOAuthRedirectPending,
    markOAuthRedirectPending,
    preferOAuthRedirectOnThisDevice,
} from './localDevAuth';

/**
 * Firebase OAuth: popup first (localhost / desktop), redirect on Safari / when popup blocked.
 * @returns {Promise<{ __oauthRedirect: true } | { result: import('firebase/auth').UserCredential }>}
 */
export async function firebaseOAuthPopupOrRedirect(provider) {
    if (preferOAuthRedirectOnThisDevice()) {
        markOAuthRedirectPending();
        try {
            await signInWithRedirect(auth, provider);
        } catch (redirectErr) {
            clearOAuthRedirectPending();
            throw redirectErr;
        }
        return { __oauthRedirect: true };
    }

    try {
        const result = await signInWithPopup(auth, provider);
        return { result };
    } catch (popupErr) {
        if (
            popupErr?.code === 'auth/popup-blocked' ||
            popupErr?.code === 'auth/cancelled-popup-request'
        ) {
            markOAuthRedirectPending();
            try {
                await signInWithRedirect(auth, provider);
            } catch (redirectErr) {
                clearOAuthRedirectPending();
                throw redirectErr;
            }
            return { __oauthRedirect: true };
        }
        throw popupErr;
    }
}
