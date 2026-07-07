import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaStore, FaEnvelope, FaTimes, FaGoogle, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { BusinessPhoneFields } from './BusinessSignup';
import { finalizeBusinessSignup } from '../services/businessPhoneSignupApi';
import {
  finalizeGoogleBusinessClaim,
  readGoogleBusinessClaimCallback,
  startGoogleBusinessClaimAuth,
  verifyGoogleBusinessPlace,
} from '../services/googleBusinessClaimApi';
import { useToast } from '../context/ToastContext';
import { AppText, AppTextInput } from './base';

const CLAIM_BTN_GREEN = {
  background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 55%, #15803d 100%)',
  border: '2px solid #bbf7d0',
  color: '#052e16',
  boxShadow: '0 6px 22px rgba(34, 197, 94, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
};

const GOOGLE_BTN_STYLE = {
  background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
  border: '2px solid rgba(255,255,255,0.85)',
  color: '#1f2937',
  boxShadow: '0 6px 22px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.9)',
};

const HERO_CLAIM_BTN = {
  ...CLAIM_BTN_GREEN,
  height: '48px',
  minHeight: '48px',
  padding: '0 20px',
  borderRadius: '24px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '0.9rem',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '0.02em',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

const HERO_GOOGLE_BTN = {
  ...GOOGLE_BTN_STYLE,
  ...HERO_CLAIM_BTN,
};

/** @typedef {'idle' | 'starting' | 'verifying' | 'verified' | 'finalizing' | 'done' | 'error'} GoogleFlowStatus */

function stripGbpParams(search) {
  const params = new URLSearchParams(search || '');
  ['gbpClaim', 'gbpSession', 'gbpError'].forEach((key) => params.delete(key));
  const next = params.toString();
  return next ? `?${next}` : '';
}

function LoadingBlock({ message }) {
  return (
    <div
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-body)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid rgba(74, 222, 128, 0.25)',
          borderTopColor: '#4ade80',
          animation: 'claim-google-spin 0.8s linear infinite',
        }}
      />
      <AppText as="p" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {message}
      </AppText>
      <style>{`@keyframes claim-google-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AlertBox({ variant, children }) {
  const isError = variant === 'error';
  return (
    <div
      role="alert"
      style={{
        marginTop: '1rem',
        padding: '0.85rem 1rem',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.65rem',
        border: `1px solid ${isError ? 'rgba(248, 113, 113, 0.45)' : 'rgba(74, 222, 128, 0.45)'}`,
        background: isError ? 'rgba(127, 29, 29, 0.22)' : 'rgba(22, 101, 52, 0.22)',
        color: isError ? '#fecaca' : '#bbf7d0',
      }}
    >
      {isError ? <FaExclamationTriangle aria-hidden style={{ marginTop: 2, flexShrink: 0 }} /> : <FaCheckCircle aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />}
      <AppText as="p" style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.45 }}>
        {children}
      </AppText>
    </div>
  );
}

/**
 * Claim CTA for unclaimed `restaurants/{id}` admin imports.
 * Google Business Profile OAuth (business.manage) + optional SMS fallback.
 */
export default function BusinessClaimPanel({
  restaurantId,
  googlePlaceId = '',
  businessName,
  businessPhoneE164 = '',
  variant = 'default',
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const placeId = String(googlePlaceId || restaurantId || '').trim();

  const processedSessionRef = useRef('');
  const autoClaimStartedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [claimMethod, setClaimMethod] = useState('google');
  const [showManualFallback, setShowManualFallback] = useState(!businessPhoneE164);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneVerification, setPhoneVerification] = useState(null);

  const [googleSessionId, setGoogleSessionId] = useState('');
  /** @type {[GoogleFlowStatus, Function]} */
  const [googleFlowStatus, setGoogleFlowStatus] = useState('idle');
  const [googleError, setGoogleError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusy =
    submitting ||
    googleFlowStatus === 'starting' ||
    googleFlowStatus === 'verifying' ||
    googleFlowStatus === 'finalizing';

  const buildReturnPath = useCallback(() => {
    const cleanSearch = stripGbpParams(location.search);
    return `${location.pathname}${cleanSearch}`;
  }, [location.pathname, location.search]);

  const clearGbpQueryParams = useCallback(() => {
    const cleanSearch = stripGbpParams(location.search);
    if (cleanSearch === (location.search || '')) return;
    navigate(
      { pathname: location.pathname, search: cleanSearch.replace(/^\?/, '') ? cleanSearch : '' },
      { replace: true, state: location.state }
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const finalizeGoogleClaim = useCallback(
    async (sessionId, accountEmail, idToken) => {
      setGoogleFlowStatus('finalizing');
      const normalizedEmail = String(accountEmail || '').trim().toLowerCase();
      const { ok, data } = await finalizeGoogleBusinessClaim(
        {
          restaurantId,
          googleClaimSessionId: sessionId,
          email: normalizedEmail,
        },
        idToken
      );
      if (!ok) {
        throw new Error(data?.message || t('claim_business_failed', 'Could not claim this business'));
      }
      setGoogleFlowStatus('done');
      showToast(t('claim_business_success', 'Business claimed successfully'), 'success');
      window.setTimeout(() => {
        setOpen(false);
        navigate(`/business/${data.uid || currentUser?.uid}`, { replace: true });
      }, 1200);
      return data;
    },
    [restaurantId, showToast, t, navigate, currentUser?.uid]
  );

  const runGoogleVerificationAndClaim = useCallback(
    async (sessionId) => {
      if (!sessionId || !placeId) return;
      if (processedSessionRef.current === sessionId) return;
      processedSessionRef.current = sessionId;

      setOpen(true);
      setClaimMethod('google');
      setGoogleError('');
      setShowManualFallback(false);
      setGoogleFlowStatus('verifying');

      try {
        const { ok, data } = await verifyGoogleBusinessPlace({
          sessionId,
          placeId,
        });

        if (!ok || !data?.managed) {
          setGoogleFlowStatus('error');
          setGoogleError(
            t(
              'claim_business_google_not_managed',
              'This Google account does not manage this location. Please try the correct email.'
            )
          );
          setShowManualFallback(true);
          if (businessPhoneE164) setClaimMethod('phone');
          return;
        }

        setGoogleSessionId(sessionId);
        setGoogleFlowStatus('verified');
        autoClaimStartedRef.current = false;

        const signedInEmail = String(currentUser?.email || '').trim().toLowerCase();
        if (signedInEmail) setEmail(signedInEmail);
      } catch (err) {
        setGoogleFlowStatus('error');
        setGoogleError(
          err?.message ||
            t(
              'claim_business_google_not_managed',
              'This Google account does not manage this location. Please try the correct email.'
            )
        );
        setShowManualFallback(true);
        if (businessPhoneE164) setClaimMethod('phone');
      }
    },
    [placeId, currentUser, businessPhoneE164, t]
  );

  useEffect(() => {
    if (googleFlowStatus !== 'verified' || !googleSessionId || authLoading || autoClaimStartedRef.current) {
      return;
    }
    if (!currentUser) return;

    autoClaimStartedRef.current = true;
    void (async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const accountEmail = String(currentUser.email || email || '').trim().toLowerCase();
        await finalizeGoogleClaim(googleSessionId, accountEmail, idToken);
      } catch (err) {
        autoClaimStartedRef.current = false;
        setGoogleFlowStatus('verified');
        showToast(err?.message || t('claim_business_failed', 'Could not claim this business'), 'error');
      }
    })();
  }, [
    googleFlowStatus,
    googleSessionId,
    authLoading,
    currentUser,
    email,
    finalizeGoogleClaim,
    showToast,
    t,
  ]);

  useEffect(() => {
    const callback = readGoogleBusinessClaimCallback(new URLSearchParams(location.search));
    if (!callback.gbpSession) return;

    setOpen(true);

    if (callback.isError) {
      setGoogleFlowStatus('error');
      setGoogleError(
        t('claim_business_google_oauth_failed', 'Google sign-in was cancelled or failed. Please try again.')
      );
      setShowManualFallback(true);
      if (businessPhoneE164) setClaimMethod('phone');
      clearGbpQueryParams();
      return;
    }

    if (callback.isConnected) {
      void runGoogleVerificationAndClaim(callback.gbpSession).finally(clearGbpQueryParams);
    }
  }, [
    location.search,
    clearGbpQueryParams,
    runGoogleVerificationAndClaim,
    businessPhoneE164,
    t,
  ]);

  const handleStartGoogleAuth = async () => {
    if (!placeId || isBusy) return;
    setGoogleFlowStatus('starting');
    setGoogleError('');
    setShowManualFallback(false);
    setOpen(true);
    setClaimMethod('google');

    try {
      const { ok, data } = await startGoogleBusinessClaimAuth({
        restaurantId,
        googlePlaceId: placeId,
        returnPath: buildReturnPath(),
      });
      if (!ok || !data?.authUrl) {
        setGoogleFlowStatus('error');
        setGoogleError(
          data?.message ||
            t('claim_business_google_start_failed', 'Could not start Google Business verification')
        );
        setShowManualFallback(true);
        return;
      }
      window.location.assign(data.authUrl);
    } catch (err) {
      setGoogleFlowStatus('error');
      setGoogleError(
        err?.message || t('claim_business_google_start_failed', 'Could not start Google Business verification')
      );
      setShowManualFallback(true);
    }
  };

  const handlePhoneClaimSubmit = async (e) => {
    e.preventDefault();
    if (!phoneVerification?.idToken || !email.trim() || isBusy) return;
    setSubmitting(true);
    try {
      const { ok, data } = await finalizeBusinessSignup(
        {
          standardizedPhone: phoneVerification.standardizedPhone,
          email: email.trim().toLowerCase(),
          claimBusinessId: restaurantId,
          businessId: restaurantId,
        },
        phoneVerification.idToken
      );
      if (!ok) {
        showToast(data?.message || t('claim_business_failed', 'Could not claim this business'), 'error');
        return;
      }
      showToast(t('claim_business_success', 'Business claimed successfully'), 'success');
      setOpen(false);
      navigate(`/business/${data.uid || phoneVerification.firebaseUid}`, { replace: true });
    } catch (err) {
      showToast(err?.message || t('claim_business_failed', 'Could not claim this business'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!googleSessionId || !email.trim() || password.length < 6 || isBusy) return;
    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      const idToken = await credential.user.getIdToken();
      await finalizeGoogleClaim(googleSessionId, email.trim().toLowerCase(), idToken);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code === 'auth/email-already-in-use') {
        showToast(
          t('claim_business_email_in_use', 'Email already in use. Sign in with that account first.'),
          'error'
        );
      } else {
        showToast(err?.message || t('claim_business_failed', 'Could not claim this business'), 'error');
      }
      setGoogleFlowStatus('verified');
    } finally {
      setSubmitting(false);
    }
  };

  const isHero = variant === 'hero';
  const phoneReady = Boolean(phoneVerification?.idToken && email.trim());
  const googleAccountReady = Boolean(
    googleSessionId && googleFlowStatus === 'verified' && email.trim() && password.length >= 6
  );

  const showGoogleLoading =
    googleFlowStatus === 'starting' ||
    googleFlowStatus === 'verifying' ||
    googleFlowStatus === 'finalizing' ||
    (googleFlowStatus === 'verified' && authLoading);

  const modal =
    open &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-business-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50000,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
        onClick={() => !isBusy && setOpen(false)}
      >
        <div
          style={{
            position: 'relative',
            zIndex: 50001,
            width: '100%',
            maxWidth: 480,
            background: 'var(--bg-card, #1a1a1a)',
            borderRadius: 16,
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          }}
          onClick={(ev) => ev.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText as="h2" id="claim-business-title" style={{ margin: 0, fontSize: '1.1rem' }}>
              {t('claim_business_request', 'Claim Business')}
            </AppText>
            <button
              type="button"
              aria-label={t('close', 'Close')}
              disabled={isBusy}
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <FaTimes />
            </button>
          </div>

          {businessName && (
            <AppText as="p" style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t('claim_business_for', { name: businessName, defaultValue: 'Claim {{name}}' })}
            </AppText>
          )}

          {showGoogleLoading && (
            <LoadingBlock
              message={
                googleFlowStatus === 'finalizing'
                  ? t('claim_business_finalizing', 'Finalizing your claim…')
                  : googleFlowStatus === 'verifying'
                    ? t('claim_business_google_verifying_locations', 'Verifying your Google Business locations…')
                    : googleFlowStatus === 'verified' && authLoading
                      ? t('claim_business_checking_account', 'Checking your account…')
                    : t('claim_business_google_redirecting', 'Redirecting to Google…')
              }
            />
          )}

          {googleFlowStatus === 'done' && !showGoogleLoading && (
            <AlertBox variant="success">
              {t('claim_business_success', 'Business claimed successfully')}
            </AlertBox>
          )}

          {googleFlowStatus === 'verified' && !showGoogleLoading && !currentUser && !authLoading && (
            <AlertBox variant="success">
              {t('claim_business_google_verify_success', 'Verification successful!')}{' '}
              {t('claim_business_google_create_account', 'Create your business account to finish.')}
            </AlertBox>
          )}

          {googleFlowStatus === 'error' && googleError && !showGoogleLoading && (
            <AlertBox variant="error">{googleError}</AlertBox>
          )}

          {!showGoogleLoading && googleFlowStatus !== 'verified' && (
            <>
              <AppText as="p" style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t(
                  'claim_business_google_hint',
                  'Sign in with the Google account that manages this business on Google Business Profile.'
                )}
              </AppText>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleStartGoogleAuth}
                style={{
                  marginTop: '0.75rem',
                  width: '100%',
                  minHeight: '48px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  opacity: isBusy ? 0.55 : 1,
                  ...GOOGLE_BTN_STYLE,
                }}
              >
                <FaGoogle aria-hidden />
                {t('claim_business_google_cta', 'Claim with Google')}
              </button>
            </>
          )}

          {googleFlowStatus === 'verified' && !currentUser && !authLoading && !showGoogleLoading && (
            <form onSubmit={handleGoogleClaimSubmit} style={{ marginTop: '1rem' }}>
              <AppText as="h3" style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800 }}>
                {t('claim_business_create_account', 'Create Account')}
              </AppText>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                <FaEnvelope style={{ marginInlineEnd: 6 }} />
                {t('email', 'Email')}
              </label>
              <AppTextInput
                type="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={isBusy}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem',
                }}
              />
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                {t('password', 'Password')}
              </label>
              <AppTextInput
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={isBusy}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={!googleAccountReady || isBusy}
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  minHeight: '48px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: !googleAccountReady || isBusy ? 'not-allowed' : 'pointer',
                  opacity: !googleAccountReady || isBusy ? 0.55 : 1,
                  ...CLAIM_BTN_GREEN,
                }}
              >
                {submitting
                  ? t('claim_business_creating_account', 'Creating account…')
                  : t('claim_business_create_account', 'Create Account')}
              </button>
            </form>
          )}

          {(showManualFallback || (businessPhoneE164 && googleFlowStatus === 'error')) && !showGoogleLoading && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <AppText as="p" style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t(
                  'claim_business_manual_fallback_hint',
                  'Or verify manually using the business phone number on Google Maps:'
                )}
              </AppText>

              {businessPhoneE164 ? (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setClaimMethod('phone')}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                        background: claimMethod === 'phone' ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.55 : 1,
                      }}
                    >
                      {t('claim_business_method_phone', 'SMS phone')}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setClaimMethod('google')}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                        background: claimMethod === 'google' ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.55 : 1,
                      }}
                    >
                      {t('claim_business_method_google', 'Google Business')}
                    </button>
                  </div>

                  {claimMethod === 'phone' && (
                    <>
                      <AppText as="p" style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t(
                          'claim_business_phone_locked_hint',
                          'Verify the Google Maps phone number for this business via SMS. The number cannot be changed.'
                        )}
                      </AppText>
                      <BusinessPhoneFields
                        lockedPhoneE164={businessPhoneE164}
                        lockFieldsAfterSend={false}
                        disabled={isBusy}
                        onVerified={(payload) => setPhoneVerification(payload)}
                      />
                      <form onSubmit={handlePhoneClaimSubmit} style={{ marginTop: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          <FaEnvelope style={{ marginInlineEnd: 6 }} />
                          {t('email', 'Email')}
                        </label>
                        <AppTextInput
                          type="email"
                          required
                          value={email}
                          onChange={(ev) => setEmail(ev.target.value)}
                          disabled={!phoneVerification || isBusy}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            borderRadius: 8,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-body)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!phoneReady || isBusy}
                          style={{
                            marginTop: '1rem',
                            width: '100%',
                            minHeight: '48px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '1rem',
                            cursor: !phoneReady || isBusy ? 'not-allowed' : 'pointer',
                            opacity: !phoneReady || isBusy ? 0.55 : 1,
                            ...CLAIM_BTN_GREEN,
                          }}
                        >
                          {submitting
                            ? t('claim_business_submitting', 'Claiming…')
                            : t('claim_business_confirm', 'Confirm claim')}
                        </button>
                      </form>
                    </>
                  )}
                </>
              ) : (
                <AppText as="p" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {t(
                    'claim_business_no_phone_fallback',
                    'No phone number is available for SMS verification. Please use a Google account that manages this location.'
                  )}
                </AppText>
              )}
            </div>
          )}
        </div>
      </div>,
      document.body
    );

  const heroBtnBase = isHero ? HERO_CLAIM_BTN : {
    marginTop: '1rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    minHeight: '48px',
    padding: '12px 20px',
    borderRadius: '14px',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          disabled={isBusy}
          style={{
            ...heroBtnBase,
            ...(isHero ? HERO_GOOGLE_BTN : { ...GOOGLE_BTN_STYLE }),
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.55 : 1,
          }}
          onClick={handleStartGoogleAuth}
        >
          <FaGoogle aria-hidden />
          {t('claim_business_google_cta', 'Claim with Google')}
        </button>

        <button
          type="button"
          disabled={isBusy}
          style={{
            ...heroBtnBase,
            ...CLAIM_BTN_GREEN,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.55 : 1,
          }}
          onClick={() => {
            setOpen(true);
            setShowManualFallback(Boolean(businessPhoneE164));
            if (businessPhoneE164) setClaimMethod('phone');
          }}
        >
          <FaStore aria-hidden />
          {businessPhoneE164
            ? t('claim_business_other_methods', 'Other options')
            : t('claim_business_request', 'Claim Business')}
        </button>
      </div>
      {modal}
    </>
  );
}
