import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaApple, FaFacebook, FaUser } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { isAffiliateAgent, isBusinessUser } from '../../utils/accountRole';
import { sanitizeNextPath } from '../../utils/safeInternalPath';
import { dismissFacebookSdkOverlay } from '../../utils/facebookSdkCleanup';
import { prepareOAuthSignInAttempt } from '../../utils/firebaseOAuthSignIn';
import {
  consumeOAuthRedirectComplete,
  consumeOAuthRedirectError,
  clearStaleOAuthRedirectFlags,
  clearGuestModeForSignIn,
  hasFirebaseAuthReturnInUrl,
  isEmbeddedPreviewBrowser,
  isFirebaseAuthorizedDevHost,
  isLocalDevHost,
  isIosTouchDevice,
  isMobileTouchDevice,
  getLocalDevOAuthLoginUrl,
  openLoginInExternalBrowser,
  peekOAuthRedirectPending,
  isRecentOAuthRedirectAttempt,
  peekOAuthRedirectProvider } from
'../../utils/localDevAuth';

/**
 * Consumer (personal) account only: Google, Facebook, and Apple — no email/password on this page.
 * Business → BusinessLoginPanel; affiliates → /affiliate/login.
 * @param {{ singleCardShell?: boolean }} props
 */import { AppText } from "../../components/base";
export default function PersonalAuthPanel({ singleCardShell = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const {
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
    continueAsGuest,
    signOut,
    userProfile,
    currentUser,
    isGuest,
    loading: authLoading
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const missingFirebaseEnv = useMemo(() => {
    if (!import.meta.env.DEV) return [];
    const keys = [
    ['VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY],
    ['VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
    ['VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID],
    ['VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID]];

    return keys.
    filter(([, v]) => !v || String(v).includes('your-')).
    map(([k]) => k);
  }, []);

  const nextPath = sanitizeNextPath(new URLSearchParams(location.search).get('next'));

  const embeddedPreview = useMemo(
    () => import.meta.env.DEV && isLocalDevHost() && isEmbeddedPreviewBrowser(),
    []
  );

  const chromeLoginUrl = useMemo(() => {
    if (typeof window === 'undefined') return getLocalDevOAuthLoginUrl();
    return `${window.location.origin}/login${location.search || ''}`;
  }, [location.search]);

  const guestLike =
  isGuest ||
  userProfile?.isGuest === true ||
  userProfile?.role === 'guest' ||
  userProfile?.uid === 'guest';

  const rejectWrongAccountType = async () => {
    try {
      await signOut();
    } catch {

      /* ignore */}
  };

  const isBusinessLoginTab = useMemo(() => {
    const q = new URLSearchParams(location.search || '');
    return q.get('tab') === 'business' || location.pathname.startsWith('/business/login');
  }, [location.search, location.pathname]);

  useEffect(() => {
    if (isBusinessLoginTab) return;
    if (authLoading || !currentUser || guestLike || !userProfile) return;
    if (isAffiliateAgent(userProfile)) {
      setError(
        t(
          'auth_affiliate_portal_only',
          'This account is an affiliate partner. Sign in from the affiliate portal only.'
        )
      );
      void rejectWrongAccountType();
      return;
    }
    if (isBusinessUser(userProfile)) {
      setError(
        t(
          'auth_business_portal_only',
          'This account is a business account. Use Business sign-in (email and password).'
        )
      );
      void rejectWrongAccountType();
    }
  }, [authLoading, currentUser, guestLike, userProfile, t, isBusinessLoginTab]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('dineb_password_reset_toast_shown') === '1') return;
    } catch {

      /* ignore */}

    let fromStorage = false;
    try {
      if (sessionStorage.getItem('dineb_password_reset_ok') === '1') {
        sessionStorage.removeItem('dineb_password_reset_ok');
        fromStorage = true;
      }
    } catch {

      /* ignore */}

    const fromQuery = new URLSearchParams(location.search).get('passwordReset') === '1';

    if (!location.state?.passwordResetSuccess && !fromStorage && !fromQuery) return;

    try {
      sessionStorage.setItem('dineb_password_reset_toast_shown', '1');
    } catch {

      /* ignore */}

    showToast(
      t(
        'password_reset_done_sign_in_social',
        'Password updated. Sign in with Google, Facebook, or Apple for your personal account.'
      ),
      'success'
    );

    if (location.state?.passwordResetSuccess) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.passwordResetSuccess, location.search, showToast, t, navigate, location.pathname]);

  useLayoutEffect(() => {
    try {
      window.scrollTo(0, 0);
      const el = document.scrollingElement;
      if (el) el.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {

      /* ignore */}
  }, []);

  const releaseLoginButtons = () => {
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!window.location.pathname.startsWith('/login')) return undefined;

    releaseLoginButtons();

    const onPageShow = () => {
      releaseLoginButtons();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/login')) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('signedOut') !== '1') return;
    releaseLoginButtons();
    params.delete('signedOut');
    const nextSearch = params.toString();
    const clean = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, document.title, clean);
  }, []);

  useEffect(() => {
    clearStaleOAuthRedirectFlags();
    const redirectErr = consumeOAuthRedirectError();
    if (redirectErr) {
      setError(getAuthErrorMessage(redirectErr) || redirectErr.message);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (currentUser) return;
    if (hasFirebaseAuthReturnInUrl()) return;
    if (peekOAuthRedirectPending()) return;
    if (peekOAuthRedirectProvider()) return;
    consumeOAuthRedirectComplete();
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (!hasFirebaseAuthReturnInUrl() && !peekOAuthRedirectPending() && !peekOAuthRedirectProvider()) {
      return undefined;
    }
    if (!hasFirebaseAuthReturnInUrl() && !isRecentOAuthRedirectAttempt()) {
      clearStaleOAuthRedirectFlags();
      return undefined;
    }
    if (authLoading) return undefined;

    const delayMs =
      peekOAuthRedirectPending() || peekOAuthRedirectProvider() ? 15000 : 4500;

    const timer = setTimeout(() => {
      if (currentUser) return;
      releaseLoginButtons();
      if (!peekOAuthRedirectPending() && !peekOAuthRedirectProvider()) return;
      const redirectErr = consumeOAuthRedirectError();
      if (redirectErr) {
        setError(getAuthErrorMessage(redirectErr) || redirectErr.message);
      } else if (peekOAuthRedirectProvider() === 'apple.com') {
        setError(
          getAuthErrorMessage({ code: 'auth/apple-config-mismatch' }) ||
            t(
              'auth_apple_popup_retry',
              'Apple sign-in did not finish. Close the app completely, reopen Safari, and try again.'
            )
        );
      } else {
        setError(
          getAuthErrorMessage({ code: 'auth/embedded-oauth-redirect-lost' }) ||
            t(
              'auth_oauth_retry_chrome',
              'Sign-in did not complete. Open https://www.dinebuddies.com/login in Chrome or Safari (not WhatsApp).'
            )
        );
      }
      clearStaleOAuthRedirectFlags();
    }, delayMs);

    return () => clearTimeout(timer);
  }, [authLoading, currentUser, t]);

  useEffect(() => {
    if (currentUser) {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const oauthBusy =
      hasFirebaseAuthReturnInUrl() ||
      peekOAuthRedirectPending() ||
      peekOAuthRedirectProvider();
    if (!oauthBusy && !authLoading) {
      setLoading(false);
    }
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setLoading(false), 20000);
    return () => clearTimeout(timer);
  }, [loading]);

  const oauthButtonsLocked = loading && !isMobileTouchDevice();

  const handleOAuth = async (provider) => {
    clearGuestModeForSignIn();
    setLoading(true);
    setError('');
    let startedRedirect = false;
    try {
      if (import.meta.env.DEV && !isFirebaseAuthorizedDevHost()) {
        setError(
          t(
            'auth_unauthorized_domain_lan',
            `This address is not allowed for sign-in. Open ${getLocalDevOAuthLoginUrl()} instead of the network IP.`
          )
        );
        return;
      }
      if (provider === 'google') {
        const googleRes = await signInWithGoogle();
        if (googleRes?.__oauthRedirect) {
          startedRedirect = true;
          return;
        }
      } else if (provider === 'apple') {
        const appleRes = await signInWithApple();
        if (appleRes?.__oauthRedirect) {
          startedRedirect = true;
          return;
        }
      } else {
        const fbRes = await signInWithFacebook();
        if (fbRes?.__oauthRedirect || fbRes?.__facebookIosRedirect) {
          startedRedirect = true;
          return;
        }
      }
    } catch (err) {
      prepareOAuthSignInAttempt();
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {

        /* ignore */} else if (
      isEmbeddedPreviewBrowser() && (
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/cancelled-popup-request' ||
      /disallowed_useragent|popup/i.test(String(err.message || ''))))
      {
        const opened = await openLoginInExternalBrowser();
        setError(
          opened.ok ?
          t(
            'auth_open_chrome_for_oauth',
            opened.mode === 'clipboard' ?
            'Login link copied. Open Chrome/Safari and paste the URL to sign in.' :
            'Login opened in a new browser tab — complete sign-in there.'
          ) :
          t(
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
    } finally {
      dismissFacebookSdkOverlay();
      if (!startedRedirect) {
        setLoading(false);
      }
    }
  };

  const btn = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#111827',
    fontWeight: '700',
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  };

  const cardShell = {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    padding: '18px'
  };

  const body =
  <div className="personal-auth-panel">
            <div className="auth-luxury-ribbon auth-luxury-ribbon--personal">
                <FaUser aria-hidden />
                <AppText as="span">{t('account_type_personal_title', 'Personal account')}</AppText>
            </div>
            <AppText as="p"
    style={{
      color: '#4b5563',
      fontSize: '0.88rem',
      margin: '0 0 1rem',
      lineHeight: 1.45,
      textAlign: 'center'
    }}>
      
                {t(
        'auth_personal_step1_subtitle',
        'Sign in or create a personal account with Google, Facebook, or Apple only.'
      )}
            </AppText>

            {missingFirebaseEnv.length > 0 &&
    <div
      role="alert"
      style={{
        background: 'rgba(239,68,68,0.12)',
        color: '#f87171',
        padding: '0.75rem',
        borderRadius: '12px',
        marginBottom: '1rem',
        fontSize: '0.85rem',
        border: '1px solid rgba(239,68,68,0.2)'
      }}>
      
                    {t(
        'auth_firebase_env_missing',
        'Firebase is not configured. Copy .env.example → .env and restart npm run dev. Missing: {{keys}}',
        { keys: missingFirebaseEnv.join(', ') }
      )}
                </div>
    }

            {import.meta.env.DEV && typeof window !== 'undefined' &&
    <AppText as="p" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', textAlign: 'center' }}>
                    <a
        href={`${window.location.origin}/login`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#2563eb', fontWeight: 700 }}>
        
                        {t('auth_open_login_in_browser', 'Open login in Chrome / Safari')}
                    </a>
                </AppText>
    }

            {error &&
    <div
      style={{
        background: 'rgba(239,68,68,0.12)',
        color: '#f87171',
        padding: '0.75rem',
        borderRadius: '12px',
        marginBottom: '1rem',
        fontSize: '0.85rem',
        textAlign: 'center',
        border: '1px solid rgba(239,68,68,0.2)'
      }}>
      
                    {error}
                </div>
    }

            <section style={{ padding: '0.2rem 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {embeddedPreview ? (
                    <a
          href={chromeLoginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-auth-social btn-google personal-auth-social"
          style={{ ...btn, textDecoration: 'none' }}>
          
                        <FcGoogle size={22} /> {t('continue_with_google_chrome', 'Continue with Google (open Chrome)')}
                    </a>
                    ) : (
                    <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={oauthButtonsLocked}
          className="btn-auth-social btn-google personal-auth-social ios-tap-target"
          style={{ ...btn, opacity: oauthButtonsLocked ? 0.65 : 1 }}>
          
                        <FcGoogle size={22} /> {t('continue_with_google', 'Continue with Google')}
                    </button>
                    )}
                    <button
          type="button"
          onClick={() => handleOAuth('facebook')}
          disabled={oauthButtonsLocked}
          className="btn-auth-social btn-facebook personal-auth-social ios-tap-target"
          style={{ ...btn, opacity: oauthButtonsLocked ? 0.65 : 1 }}>
          
                        <FaFacebook size={22} color="#1877F2" />{' '}
                        {t('continue_with_facebook', 'Continue with Facebook')}
                    </button>
                    <button
          type="button"
          onClick={() => handleOAuth('apple')}
          disabled={oauthButtonsLocked}
          className="btn-auth-social btn-apple personal-auth-social ios-tap-target"
          style={{
            ...btn,
            background: '#000000',
            color: '#ffffff',
            border: '1px solid #000000',
            opacity: oauthButtonsLocked ? 0.65 : 1
          }}>
          
                        <FaApple size={22} aria-hidden /> {t('continue_with_apple', 'Continue with Apple')}
                    </button>
                </div>

                <button
        type="button"
        onClick={async () => {
          await continueAsGuest();
          navigate('/posts-feed', { replace: true });
        }}
        disabled={oauthButtonsLocked}
        className="personal-auth-guest-link ios-tap-target"
        style={{
          background: 'none',
          border: 'none',
          color: '#4b5563',
          fontSize: '0.82rem',
          cursor: oauthButtonsLocked ? 'not-allowed' : 'pointer',
          textDecoration: 'underline',
          marginTop: '1rem',
          width: '100%'
        }}>
        
                    {t('continue_as_guest', 'Continue as guest')}
                </button>
            </section>
        </div>;


  return (
    <div id="personal-login-panel" style={{ width: '100%', minWidth: 0 }}>
            {singleCardShell ? body : <div style={cardShell}>{body}</div>}
        </div>);

}