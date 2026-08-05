import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { FaEnvelope, FaLock, FaArrowRight, FaEye, FaEyeSlash, FaUser } from 'react-icons/fa';
import {
  resolveBusinessLoginForSignIn,
  requestBusinessPasswordReset,
  BUSINESS_LOGIN_INVALID_MSG_EN,
  BUSINESS_AI_UNCLAIMED_MSG_AR } from
'../../services/businessLoginApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { isAffiliateAgent, isBusinessUser, hasBusinessSessionHint } from '../../utils/accountRole';
import { accountKindFromProfileData, AUTH_PORTAL } from '../../utils/authPortalGate';
import { resolveBusinessPostLoginPath } from '../../utils/postAuthRedirect';
import { resolveSignedInHomePath } from '../../utils/accountKind';
import { clearPostLogoutRedirect } from '../../utils/localDevAuth';

/**
 * Business email/password sign-in.
 * @param embedInHub — hide "regular user" link when nested in LoginHub.
 * @param embeddedInSingleCard — lighter chrome inside LoginHub’s one shared card.
 */import { AppText, AppTextInput } from "../../components/base";
export default function BusinessLoginPanel({ embedInHub = false, embeddedInSingleCard = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const {
    signInWithEmail,
    sendPasswordResetToEmail,
    userProfile,
    currentUser,
    signOut,
    loading: authLoading,
    profileServerSynced
  } = useAuth();

  const [loginId, setLoginId] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [aiUnclaimedHint, setAiUnclaimedHint] = useState(false);

  useEffect(() => {
    const verified = new URLSearchParams(location.search).get('verified') === '1';
    const fromVerify = new URLSearchParams(location.search).get('fromVerify') === '1';
    if (verified || fromVerify) {
      showToast(
        t('business_email_verified_sign_in', 'Email verified. Sign in with your business password to continue.'),
        'success'
      );
    }
  }, [location.search, showToast, t]);

  const goBusinessHome = () => {
    const fromVerify = new URLSearchParams(location.search).get('fromVerify') === '1';
    const verified = new URLSearchParams(location.search).get('verified') === '1';
    if (fromVerify || verified) {
      navigate(resolveSignedInHomePath(currentUser, userProfile) || '/business-dashboard', { replace: true });
      return;
    }
    navigate(resolveBusinessPostLoginPath(location.search), { replace: true });
  };

  useEffect(() => {
    if (authLoading || !currentUser || !profileServerSynced) return;

    if (userProfile && isAffiliateAgent(userProfile)) {
      if (!justLoggedIn) return;
      setError(
        t(
          'auth_affiliate_portal_only',
          'This account is an affiliate partner. Use the affiliate sign-in page only.'
        )
      );
      setJustLoggedIn(false);
      signOut('/affiliate/login').catch(() => {});
      return;
    }

    const profileIsBusiness = Boolean(
      userProfile &&
        (isBusinessUser(userProfile) ||
          accountKindFromProfileData(userProfile) === AUTH_PORTAL.BUSINESS)
    );
    const businessSession =
      justLoggedIn || profileIsBusiness || hasBusinessSessionHint(currentUser.uid);

    if (
      businessSession &&
      (justLoggedIn ||
        location.pathname === '/login' ||
        location.pathname.startsWith('/business/login'))
    ) {
      goBusinessHome();
    }
  }, [justLoggedIn, currentUser, userProfile, authLoading, profileServerSynced, location.pathname, location.search, navigate, signOut, t]);

  const invalidLoginMsg = t('business_login_invalid_credentials', BUSINESS_LOGIN_INVALID_MSG_EN);

  const handleAiUnclaimed = () => {
    setAiUnclaimedHint(true);
    setError(t('business_ai_unclaimed_login', BUSINESS_AI_UNCLAIMED_MSG_AR));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setAiUnclaimedHint(false);
    try {
      const emailForAuth = await resolveBusinessLoginForSignIn(loginId, password, countryCode);
      await signInWithEmail(emailForAuth, password, { portal: AUTH_PORTAL.BUSINESS });
      clearPostLogoutRedirect();
      setJustLoggedIn(true);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'unclaimed-ai-profile' || code === 'ai-unclaimed') {
        handleAiUnclaimed();
        return;
      }
      if (code === 'auth-failed') {
        setError(err?.message || invalidLoginMsg);
        return;
      }
      setError(invalidLoginMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError('');
    setAiUnclaimedHint(false);
    try {
      const reset = await requestBusinessPasswordReset(loginId, countryCode);
      if (reset.genericOnly || !reset.email) {
        showToast(
          reset.message ||
          t('auth_reset_generic_success'),
          'success'
        );
        return;
      }
      await sendPasswordResetToEmail(reset.email);
      showToast(
        reset.message ||
        t('auth_reset_email_sent', 'Check your inbox for a password reset link.'),
        'success'
      );
    } catch (err) {
      if (err?.code === 'invalid-input') {
        setError(err?.message || t('auth_enter_email_reset', 'Enter your email or phone above.'));
      } else {
        setError(
          getAuthErrorMessage(err) ||
          err.message ||
          t('auth_reset_failed', 'Could not send reset email.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const card = embeddedInSingleCard ?
  {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100%',
    margin: 0,
    padding: '0.85rem',
    borderRadius: '12px',
    border: 'none',
    background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    boxShadow: 'none',
    minHeight: 0,
    boxSizing: 'border-box'
  } :
  {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    padding: 'clamp(1rem, 4.5vw, 1.35rem)',
    borderRadius: '16px',
    border: '1px solid color-mix(in srgb, var(--primary) 18%, var(--border-color))',
    background: 'var(--bg-card)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 24px 56px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent)',
    minHeight: 0,
    boxSizing: 'border-box'
  };

  const primaryBtn = {
    width: '100%',
    padding: '14px',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
    color: '#fff',
    fontWeight: 800,
    cursor: loading ? 'wait' : 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 35%, transparent)'
  };

  const outlineBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
    color: 'var(--primary)',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.9rem'
  };

  const iconBox = embeddedInSingleCard ?
  {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    margin: '0 auto 0.65rem',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.35rem',
    boxShadow: '0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent)'
  } :
  {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    margin: '0 auto 1rem',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 40%, transparent)'
  };

  return (
    <div
      id={embeddedInSingleCard ? undefined : 'business-login-panel'}
      className="business-auth-panel"
      style={{ width: '100%', minWidth: 0 }}>
      
            <div
        className={embeddedInSingleCard ? 'business-auth-card business-auth-card--embedded' : 'glass-card business-auth-card'}
        style={card}>
        
                <div className="auth-luxury-ribbon auth-luxury-ribbon--business">
                    <HiBuildingStorefront aria-hidden />
                    <AppText as="span">{t('business_login', 'Business')}</AppText>
                </div>
                <div style={{ textAlign: 'center', marginBottom: embeddedInSingleCard ? '0.85rem' : '1.25rem' }}>
                    <div style={iconBox}>
                        <HiBuildingStorefront style={{ color: '#fff' }} />
                    </div>
                    <AppText as="h2"
          style={{
            fontSize: embeddedInSingleCard ?
            'clamp(1.05rem, 3vw, 1.25rem)' :
            'clamp(1.2rem, 3.5vw, 1.5rem)',
            fontWeight: 900,
            margin: '0 0 0.35rem',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent'
          }}>
            
                        {t('business_login_title', 'Business Login')}
                    </AppText>
                    <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: embeddedInSingleCard ? '0.85rem' : '0.92rem', margin: 0 }}>
                        {t('business_login_subtitle', 'Sign in to your DineBuddies business account')}
                    </AppText>
                </div>

                {error &&
        <div
          style={{
            background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
            color: 'var(--color-danger)',
            padding: '0.75rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            textAlign: 'center',
            border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)'
          }}>
          
                        {error}
                        {aiUnclaimedHint &&
          <AppText as="p" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                                <button
              type="button"
              onClick={() =>
              navigate(
                `/signup/business${typeof window !== 'undefined' ? window.location.search || '' : ''}`
              )
              }
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 800,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit'
              }}>
              
                                    {t('business_claim_account_cta')}
                                </button>
                            </AppText>
          }
                    </div>
        }

                <form onSubmit={handleSubmit} className="business-auth-form">
                    <div style={{ marginBottom: '1rem' }}>
                        <label
              style={{
                display: 'block',
                marginBottom: '0.4rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--text-secondary)'
              }}>
              
                            {t('business_login_credentials_label')}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <FaUser
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'color-mix(in srgb, var(--primary) 55%, var(--text-muted))',
                  fontSize: '0.9rem'
                }} />
              
                            <AppTextInput
                type="text"
                autoComplete="username"
                placeholder={t('business_login_identifier')}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 1rem 12px 2.75rem',
                  borderRadius: '12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }} />
              
                        </div>
                        {!loginId.includes('@') && loginId.length > 0 &&
            <div style={{ marginTop: '0.5rem' }}>
                                <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem'
                }}>
                
                                    {t('business_login_country_code_label')}
                                </label>
                                <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)'
                }}
                aria-label={t('business_login_country_code_label')}>
                
                                    <option value="+20">{t('phone_country_eg')} (+20)</option>
                                    <option value="+966">{t('phone_country_sa')} (+966)</option>
                                    <option value="+971">{t('phone_country_ae')} (+971)</option>
                                    <option value="+962">{t('phone_country_jo')} (+962)</option>
                                </select>
                            </div>
            }
                    </div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label
              style={{
                display: 'block',
                marginBottom: '0.4rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--text-secondary)'
              }}>
              
                            {t('password')}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <FaLock
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'color-mix(in srgb, var(--primary) 55%, var(--text-muted))',
                  fontSize: '0.9rem'
                }} />
              
                            <AppTextInput
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('password', 'Password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 3rem 12px 2.75rem',
                  borderRadius: '12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }} />
              
                            <button
                type="button"
                aria-label={showPassword ? t('hide_password', 'Hide password') : t('show_password', 'Show password')}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex'
                }}>
                
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>
                    <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '0.85rem',
              width: '100%',
              textAlign: 'right',
              textDecoration: 'underline',
              padding: 0,
              fontFamily: 'inherit'
            }}>
            
                        {t('forgot_password', 'Forgot password?')}
                    </button>
                    <button type="submit" disabled={loading} style={primaryBtn}>
                        {loading ? t('business_login_verifying') : t('sign_in')}
                        {!loading && <FaArrowRight />}
                    </button>
                </form>

                <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid color-mix(in srgb, var(--primary) 12%, var(--border-color))',
            textAlign: 'center'
          }}>
          
                    <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        {t('no_business_account', "Don't have a business account?")}
                    </AppText>
                    <button
            type="button"
            onClick={() =>
            navigate(`/signup/business${typeof window !== 'undefined' ? window.location.search || '' : ''}`)
            }
            style={outlineBtn}>
            
                        {t('create_business_account', 'Create Business Account')}
                    </button>
                    {!embedInHub &&
          <AppText as="p" style={{ marginTop: '1.25rem', fontSize: '0.88rem' }}>
                            <Link
              to="/login"
              style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
              
                                {t('regular_user_sign_in', 'Regular user? Sign in here')}
                            </Link>
                        </AppText>
          }
                </div>
            </div>
        </div>);

}