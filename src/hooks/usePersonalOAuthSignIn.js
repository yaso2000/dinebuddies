import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../utils/errorMessages';
import {
    isEmbeddedPreviewBrowser,
    isFirebaseAuthorizedDevHost,
    isLocalDevHost,
    getLocalDevOAuthLoginUrl,
    openLoginInExternalBrowser,
    clearGuestModeForSignIn,
} from '../utils/localDevAuth';
import { prepareOAuthSignInAttempt } from '../utils/firebaseOAuthSignIn';

/**
 * Shared Google / Apple / Facebook OAuth for personal (consumer) accounts.
 * @param {(() => void) | null} [onBeforeOAuth]
 * @param {(() => void) | null} [onOAuthRedirect]
 */
export function usePersonalOAuthSignIn(onBeforeOAuth, onOAuthRedirect) {
    const { t } = useTranslation();
    const { signInWithGoogle, signInWithApple, signInWithFacebook } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const runOAuth = useCallback(
        async (provider) => {
            prepareOAuthSignInAttempt();
            setLoading(true);
            setError('');
            let startedRedirect = false;
            try {
                onBeforeOAuth?.();

                if (import.meta.env.DEV && !isFirebaseAuthorizedDevHost()) {
                    setError(
                        t(
                            'auth_unauthorized_domain_lan',
                            `This address is not allowed for sign-in. Open ${getLocalDevOAuthLoginUrl()} instead of the network IP.`
                        )
                    );
                    return { ok: false };
                }

                let result = null;
                if (provider === 'google') {
                    result = await signInWithGoogle();
                } else if (provider === 'apple') {
                    result = await signInWithApple();
                } else {
                    result = await signInWithFacebook();
                }

                if (result?.__oauthRedirect) {
                    startedRedirect = true;
                    onOAuthRedirect?.();
                    return { ok: true, redirect: true };
                }

                return { ok: true, redirect: false };
            } catch (err) {
                prepareOAuthSignInAttempt();
                if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                    return { ok: false, cancelled: true };
                }
                if (
                    isEmbeddedPreviewBrowser() &&
                    (err.code === 'auth/popup-blocked' ||
                        err.code === 'auth/cancelled-popup-request' ||
                        /disallowed_useragent|popup/i.test(String(err.message || '')))
                ) {
                    const opened = await openLoginInExternalBrowser();
                    setError(
                        opened.ok
                            ? t(
                                  'auth_open_chrome_for_oauth',
                                  opened.mode === 'clipboard'
                                      ? 'Login link copied. Open Chrome/Safari and paste the URL to sign in.'
                                      : 'Login opened in a new browser tab — complete sign-in there.'
                              )
                            : t(
                                  'auth_open_chrome_for_oauth',
                                  `Open this URL in Chrome: ${window.location.origin}/login`
                              )
                    );
                } else if (err.code === 'auth/in-app-browser') {
                    setError(
                        t('auth_in_app_browser_hint', 'Open this site in Safari or Chrome to sign in.')
                    );
                } else {
                    setError(getAuthErrorMessage(err) || err.message);
                }
                return { ok: false };
            } finally {
                if (!startedRedirect) {
                    setLoading(false);
                }
            }
        },
        [onBeforeOAuth, onOAuthRedirect, signInWithApple, signInWithFacebook, signInWithGoogle, t]
    );

    return {
        loading,
        error,
        setError,
        signInWithGoogle: () => runOAuth('google'),
        signInWithApple: () => runOAuth('apple'),
        signInWithFacebook: () => runOAuth('facebook'),
    };
}
