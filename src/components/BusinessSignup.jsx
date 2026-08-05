import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaLock, FaCheck, FaStore, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { sendVerificationEmailResend, verificationEmailErrorMessage } from '../services/verificationEmailService';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import BusinessAuthShell from '../pages/auth/BusinessAuthShell';
import LocationAutocomplete from './LocationAutocomplete';
import { parseGoogleAddressComponents } from '../utils/googlePlacesBusiness';
import {
  ENABLE_BACKGROUND_AREA_DETECT,
  GEOLOCATION_OPTIONS,
  detectCityCountryInBackground } from
'../utils/bigDataCloudGeocode';
import {
  peekPendingReferralCode,
  clearPendingReferralCode,
  syncPendingReferralFromQueryString } from
'../utils/pendingReferral';
import {
  formatToE164,
  isValidE164,
  defaultDialCodeForCountryIso,
  cleanedPhoneLength,
  toCountryCodeSelectValue,
  formatPhoneForDisplay,
  parseE164ToParts,
  phoneNumberLtrStyle,
  compactE164FromGoogleInternational,
} from
'../utils/phoneUtils';
import { PHONE_COUNTRY_OPTIONS } from '../constants/phoneCountryCodes';
import {
  sendFirebaseBusinessPhoneOtp,
  confirmFirebaseBusinessPhoneOtp,
  clearBusinessPhoneRecaptcha,
  firebasePhoneAuthErrorMessage,
  BUSINESS_PHONE_RECAPTCHA_ID } from
'../services/businessPhoneFirebaseAuth';
import { lookupBusinessPhone, finalizeBusinessSignup } from '../services/businessPhoneSignupApi';
import { FaPhone } from 'react-icons/fa';
import './BusinessSignup.css';
import { AppText, AppTextInput } from "./base";

const OTP_LENGTH = 6;
const SEND_COOLDOWN_SEC = 60;

/**
 * Business phone verification via Firebase Phone Auth (SMS OTP).
 * @param {{ defaultDialCode?: string, disabled?: boolean, lockFieldsAfterSend?: boolean, lockedPhoneE164?: string, onVerified: Function }} props
 */
export function BusinessPhoneFields({ defaultDialCode, disabled, lockFieldsAfterSend = true, lockedPhoneE164 = '', onVerified }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';

  const [countryCode, setCountryCode] = useState(() => toCountryCodeSelectValue(defaultDialCode || '61'));
  const [rawPhone, setRawPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [standardizedPhone, setStandardizedPhone] = useState('');
  const [claimMeta, setClaimMeta] = useState(null);

  const phoneLocked = Boolean(String(lockedPhoneE164 || '').trim());

  useEffect(() => {
    if (!phoneLocked) return;
    const parts = parseE164ToParts(lockedPhoneE164);
    if (!parts) return;
    setCountryCode(parts.countryCode);
    setRawPhone(parts.localNumber);
    setStandardizedPhone(compactE164FromGoogleInternational(lockedPhoneE164));
  }, [lockedPhoneE164, phoneLocked]);

  const standardizedPreview = useMemo(() => {
    if (phoneLocked) {
      return compactE164FromGoogleInternational(lockedPhoneE164);
    }
    return formatToE164(countryCode, rawPhone);
  }, [phoneLocked, lockedPhoneE164, countryCode, rawPhone]);

  useEffect(() => {
    if (phoneLocked) return;
    setCountryCode(toCountryCodeSelectValue(defaultDialCode || '61'));
  }, [defaultDialCode, phoneLocked]);

  useEffect(() => () => clearBusinessPhoneRecaptcha(), []);

  /** @type {React.MutableRefObject<import('firebase/auth').ConfirmationResult | null>} */
  const confirmationRef = React.useRef(null);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const fieldsLocked = disabled || phoneVerified || phoneLocked || lockFieldsAfterSend && isOtpSent;

  const handleSendOTP = async (e) => {
    e?.preventDefault?.();
    setErrorMessage('');

    const standardized = phoneLocked
      ? compactE164FromGoogleInternational(lockedPhoneE164)
      : formatToE164(countryCode, rawPhone);
    if (!standardized || !isValidE164(standardized)) {
      setErrorMessage(t('business_phone_invalid'));
      return;
    }
    if (!phoneLocked && cleanedPhoneLength(rawPhone) < 7) {
      setErrorMessage(t('business_phone_invalid'));
      return;
    }

    setCountdown(SEND_COOLDOWN_SEC);
    setSending(true);
    showToast(t('business_phone_sending'), 'info');

    try {
      const lookup = await lookupBusinessPhone(standardized);
      if (!lookup.ok) {
        setErrorMessage(
          lookup.data?.message ||
          t('business_phone_send_failed')
        );
        setCountdown(0);
        return;
      }

      const status = lookup.data.status || 'new_register_flow';
      if (status !== 'claim_flow') {
        setClaimMeta(null);
        setErrorMessage(t('business_phone_not_claimable'));
        setCountdown(0);
        return;
      }

      setClaimMeta({
        businessId: lookup.data.businessId,
        businessName: lookup.data.businessName
      });
      confirmationRef.current = await sendFirebaseBusinessPhoneOtp(standardized);
      setStandardizedPhone(lookup.data.standardizedPhone || standardized);
      setIsOtpSent(true);
      showToast(t('business_phone_otp_sent', 'Verification code sent via SMS'), 'info');
    } catch (err) {
      setErrorMessage(firebasePhoneAuthErrorMessage(err));
      setCountdown(0);
      clearBusinessPhoneRecaptcha();
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = useCallback(async () => {
    const code = otpCode.replace(/\D/g, '');
    if (code.length < OTP_LENGTH || !standardizedPhone) {
      setErrorMessage(t('business_phone_code_invalid'));
      return;
    }
    setErrorMessage('');
    setVerifying(true);
    try {
      if (!confirmationRef.current) {
        setErrorMessage(t('business_phone_send_failed', 'Request a new code first'));
        return;
      }
      const confirmed = await confirmFirebaseBusinessPhoneOtp(confirmationRef.current, code);
      setPhoneVerified(true);
      onVerified({
        standardizedPhone: confirmed.phoneNumber || standardizedPhone,
        firebaseUid: confirmed.uid,
        idToken: confirmed.idToken,
        flow: 'claim',
        businessId: claimMeta?.businessId,
        businessName: claimMeta?.businessName
      });
      showToast(t('business_phone_verified'), 'success');
    } catch (err) {
      setErrorMessage(firebasePhoneAuthErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }, [otpCode, standardizedPhone, claimMeta, onVerified, showToast, t]);

  const sendBtnDisabled =
  disabled || sending || countdown > 0 || lockFieldsAfterSend && isOtpSent || phoneVerified;

  return (
    <div className="biz-phone-verify signup-phone-block" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="biz-phone-verify__row">
                <label className="biz-phone-verify__label">
                    {t('business_phone_label')}
                </label>
                {phoneLocked ?
      <div
        className="biz-phone-verify__locked-phone"
        style={phoneNumberLtrStyle()}
        dir="ltr"
        aria-live="polite">
                    {formatPhoneForDisplay(standardizedPreview)}
                </div> :

      <div className="biz-phone-verify__inputs">
                    <select
            className="biz-phone-verify__country"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            disabled={fieldsLocked}
            aria-label={t('business_phone_country_code')}>

                        {PHONE_COUNTRY_OPTIONS.map((c) =>
            <option key={c.iso} value={`+${c.dial}`}>
                                {t(c.labelKey, c.labelFallback)} (+{c.dial})
                            </option>
            )}
                    </select>
                    <div className="biz-phone-verify__local-wrap">
                        <FaPhone className="biz-phone-verify__icon" aria-hidden />
                        <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              className="biz-phone-verify__local"
              placeholder="1012345678"
              value={rawPhone}
              onChange={(e) => setRawPhone(e.target.value)}
              disabled={fieldsLocked} />

                    </div>
                </div>
      }
            </div>

            {errorMessage &&
      <AppText as="p" className="biz-phone-verify__error" role="alert">
                    {errorMessage}
                </AppText>
      }

            <div id={BUSINESS_PHONE_RECAPTCHA_ID} className="biz-phone-verify__recaptcha" aria-hidden="true" />
            <button
        type="button"
        className="biz-phone-verify__send-btn"
        disabled={sendBtnDisabled}
        onClick={handleSendOTP}>

                {sending ?
        t('sending') :
        countdown > 0 ?
        t('business_phone_resend_in', { sec: countdown }) :
        t('send_code')}
            </button>

            {phoneVerified &&
      <AppText as="p" className="biz-phone-verify__verified">
                    {t('business_phone_verified')} ({standardizedPhone})
                </AppText>
      }

            {isOtpSent && !phoneVerified &&
      <div className="biz-phone-verify__otp-block">
                    <AppText as="h3" className="biz-phone-verify__otp-title">
                        {t('business_phone_otp_hint')}
                    </AppText>
                    {claimMeta?.businessName &&
        <AppText as="p" className="biz-phone-verify__otp-flow-msg">
                            {t('business_phone_claim_banner', {
            name: claimMeta.businessName,
            defaultValue: 'We found an existing profile for this number: {{name}}. Verify to claim it.'
          })}
                        </AppText>
        }
                    <AppText as="p" className="biz-phone-verify__otp-flow-msg">
                        {t('business_phone_claim_otp_hint')}
                    </AppText>
                    <AppTextInput
          type="text"
          inputMode="numeric"
          maxLength={OTP_LENGTH}
          className="biz-phone-verify__otp-single"
          placeholder="******"
          value={otpCode}
          onChange={(e) =>
          setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))
          } />

                    <button
          type="button"
          className="biz-phone-verify__verify-btn"
          disabled={verifying || otpCode.replace(/\D/g, '').length < OTP_LENGTH}
          onClick={handleVerifyOtp}>

                        {verifying ?
          t('verifying') :
          t('business_phone_confirm_claim')}
                    </button>
                </div>
      }
        </div>);

}

const STEPS = {
  AUTH: 1,
  DETAILS: 2
};

/** @returns {'empty'|'email_like'|'same_as_email'|null} */
function businessNameValidationError(name, accountEmail) {
  const n = (name || '').trim();
  const e = (accountEmail || '').trim().toLowerCase();
  if (!n) return 'empty';
  if (n.includes('@')) return 'email_like';
  if (e && n.toLowerCase() === e) return 'same_as_email';
  return null;
}

const BusinessSignup = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';
  /** Leading edge of the input: icon sits here; padding reserves space for text. */
  const fieldIconStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: '1rem',
    zIndex: 2,
    ...(isRtl ? { right: '1rem', left: 'auto' } : { left: '1rem', right: 'auto' })
  };
  const inputStyleWithIcon = {
    width: '100%',
    padding: isRtl ? '0.9rem 3rem 0.9rem 1rem' : '0.9rem 1rem 0.9rem 3rem',
    background: 'var(--bg-body)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    boxSizing: 'border-box'
  };
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(STEPS.AUTH);

  useLayoutEffect(() => {
    syncPendingReferralFromQueryString(location.search);
  }, [location.search]);
  const [loading, setLoading] = useState(false);

  // Step 1: Auth Info
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Business name (always required) + address from Google Places only
  const [areaDetecting, setAreaDetecting] = useState(() => ENABLE_BACKGROUND_AREA_DETECT);
  const [searchQuery, setSearchQuery] = useState('');
  const [businessData, setBusinessData] = useState({
    businessName: '',
    businessType: 'Restaurant',
    location: '',
    city: '',
    country: '',
    countryCode: 'AU',
    lat: null,
    lng: null,
    userLat: null,
    userLng: null,
    placeId: null,
    phone: '',
    website: '',
    openingHours: null,
    photos: [],
    rating: null,
    userRatingsTotal: null,
    priceLevel: null,
    businessStatus: null,
    editorialSummary: ''
  });

  useEffect(() => {
    if (!ENABLE_BACKGROUND_AREA_DETECT) {
      setAreaDetecting(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const detected = await detectCityCountryInBackground({
          defaultCountryCode: 'AU',
          geolocationOptions: GEOLOCATION_OPTIONS
        });
        if (!mounted) return;
        setBusinessData((prev) => ({
          ...prev,
          userLat: detected.lat ?? prev.userLat,
          userLng: detected.lng ?? prev.userLng,
          countryCode: detected.countryCode || prev.countryCode,
          country: detected.countryName || prev.country,
          ...(detected.city ? { city: detected.city } : {})
        }));
      } finally {
        if (mounted) setAreaDetecting(false);
      }
    })();
    return () => {mounted = false;};
  }, []);

  const validateAuth = () => {
    if (!email?.trim() || !password || !confirmPassword) {
      showToast(t('business_signup_err_fill_all', 'Please fill in all required fields'), 'error');
      return false;
    }
    if (password.length < 6) {
      showToast(t('error_password_length', 'Password must be at least 6 characters'), 'error');
      return false;
    }
    if (password !== confirmPassword) {
      showToast(t('error_passwords_match', 'Passwords do not match'), 'error');
      return false;
    }
    return true;
  };

  const handleNext = async (e) => {
    e.preventDefault();
    if (!validateAuth()) return;

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (
      auth.currentUser?.email?.toLowerCase() !== normalizedEmail ||
      !auth.currentUser?.email)
      {
        if (auth.currentUser) {
          await signOut(auth);
        }
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        // Mark Firestore as business signup before any consumer profile bootstrap runs.
        await setDoc(
          doc(db, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            email: normalizedEmail,
            accountType: 'business',
            role: 'partner',
            registrationIntent: 'business',
            pendingBusinessRegistration: true,
            created_at: serverTimestamp(),
            last_active_time: serverTimestamp(),
          },
          { merge: true }
        );
      }
      setStep(STEPS.DETAILS);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code === 'auth/email-already-in-use') {
        showToast(t('auth_email_in_use', 'This email is already registered'), 'error');
      } else if (code === 'auth/weak-password') {
        showToast(t('error_password_length', 'Password must be at least 6 characters'), 'error');
      } else {
        showToast(err?.message || t('business_signup_err_create', 'Failed to create account'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(STEPS.AUTH);
  };

  /** LocationAutocomplete selection payload (Google minimal in business flow). */
  const handlePlaceSelect = useCallback((place) => {
    const fullAddress = (place.fullAddress || '').trim();
    const lat = place.lat ?? null;
    const lng = place.lng ?? null;
    let city = '';
    let country = '';
    let countryCode = '';
    if (place.addressComponents) {
      const p = parseGoogleAddressComponents(place.addressComponents);
      city = p.city;
      country = p.country;
      countryCode = p.countryCode || '';
    }
    const suggestedName = (place.name || '').trim();

    setBusinessData((prev) => ({
      ...prev,
      businessName: prev.businessName.trim() ? prev.businessName : suggestedName || prev.businessName,
      location: fullAddress,
      city: city || prev.city,
      country: country || prev.country,
      countryCode: countryCode || prev.countryCode,
      lat,
      lng,
      placeId: place.placeId || null,
      phone: (place.phone || '').trim(),
      website: (place.website || '').trim(),
      openingHours: place.openingHours ?? null,
      photos: [],
      rating: place.rating ?? null,
      userRatingsTotal: place.userRatingsTotal ?? null,
      priceLevel: place.priceLevel ?? null,
      businessStatus: place.businessStatus ?? null,
      editorialSummary: (place.editorialSummary || '').trim()
    }));
    setSearchQuery(fullAddress || suggestedName);
  }, []);

  const handleBusinessNameChange = (e) => {
    setBusinessData((prev) => ({ ...prev, businessName: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== STEPS.DETAILS) return;

    const nameErr = businessNameValidationError(businessData.businessName, email);
    if (nameErr === 'empty') {
      showToast(t('business_signup_err_name_required', 'Enter your business name (not your email).'), 'error');
      return;
    }
    if (nameErr === 'email_like' || nameErr === 'same_as_email') {
      showToast(t('business_signup_err_name_not_email', 'Use your trading or venue name — not your email address.'), 'error');
      return;
    }
    if (!businessData.location?.trim()) {
      showToast(t('business_signup_err_details', 'Please search and select your business first.'), 'error');
      return;
    }
    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        showToast(t('business_signup_err_create', 'Failed to create account.'), 'error');
        return;
      }

      const businessInfo = {
        businessName: businessData.businessName.trim(),
        businessType: businessData.businessType,
        phone: businessData.phone || '',
        isClaimed: true,
        phone_verified: false,
        phone_claimed: false,
        city: businessData.city,
        country: businessData.country,
        description: businessData.editorialSummary || '',
        website: businessData.website || '',
        address: businessData.location,
        lat: businessData.lat,
        lng: businessData.lng,
        placeId: businessData.placeId,
        hours: businessData.openingHours,
        coverImage: null,
        galleryEnhanced: [],
        gallery: [],
        googlePlaceRating: businessData.rating,
        googleUserRatingsTotal: businessData.userRatingsTotal,
        priceLevel: businessData.priceLevel,
        businessStatus: businessData.businessStatus,
        isPublished: false
      };

      const pendingReferral = peekPendingReferralCode();
      const { ok, data } = await finalizeBusinessSignup(
        {
          email: email.trim(),
          businessInfo,
          referredBy: pendingReferral || null
        },
        idToken
      );

      if (!ok) {
        const msg = data?.message || t('business_signup_err_create', 'Failed to create account.');
        if (data?.code === 'auth/email-already-in-use') {
          showToast(t('auth_email_in_use', 'This email is already registered'), 'error');
          setStep(STEPS.AUTH);
        } else {
          showToast(msg, 'error');
        }
        return;
      }

      if (pendingReferral) clearPendingReferralCode();

      if (!auth.currentUser) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      const uid = data.uid || auth.currentUser?.uid;

      try {
        await sendVerificationEmailResend('business_signup');
      } catch (verErr) {
        console.warn('Post-creation verification email error:', verErr);
        showToast(
          verificationEmailErrorMessage(
            verErr,
            t('business_signup_verify_email_failed', 'Account created, but we could not send the activation email. Use “Resend” in the banner at the top of your profile.')
          ),
          'error'
        );
      }

      navigate(`/business/${uid}`, {
        replace: true,
        state: { businessSignupNeedsVerify: true }
      });
    } catch (err) {
      console.error('Error creating business account:', err);
      showToast(err.message || t('business_signup_err_create', 'Failed to create account.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BusinessAuthShell>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', justifyContent: 'center' }}>
                <div style={{ height: '4px', width: '40px', background: step >= 1 ? 'var(--primary)' : 'var(--border-color)', borderRadius: '2px' }} />
                <div style={{ height: '4px', width: '40px', background: step >= 2 ? 'var(--primary)' : 'var(--border-color)', borderRadius: '2px' }} />
            </div>

            {step === STEPS.AUTH &&
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, var(--primary), #f97316)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem' }}>
                            <HiBuildingStorefront style={{ color: 'white' }} />
                        </div>
                        <AppText as="h1" style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.5rem', background: 'linear-gradient(135deg, var(--primary), #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {t('business_signup_title', 'Grow Your Business')}
                        </AppText>
                    </div>

                    <form onSubmit={handleNext}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>{t('email', 'Business Email')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={fieldIconStyle} />
                                <AppTextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyleWithIcon} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>{t('password', 'Password')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={fieldIconStyle} />
                                <AppTextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={inputStyleWithIcon} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={labelStyle}>{t('confirm_password', 'Confirm Password')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={fieldIconStyle} />
                                <AppTextInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} style={inputStyleWithIcon} />
                            </div>
                        </div>

                        <button type="submit" style={btnStyle} disabled={loading}>
                            {loading ? t('creating_profile', 'Creating profile…') : t('next', 'Next Step')}{' '}
                            {!loading ? <FaChevronRight size={14} /> : null}
                        </button>
                    </form>
                </div>
      }

            {step === STEPS.DETAILS &&
      <div style={{ animation: 'slideInRight 0.4s ease-out' }}>
                    <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        <FaChevronLeft /> {t('back', 'Back')}
                    </button>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: 0 }}>
                            {t('business_signup_step2_title', 'Business information')}
                        </AppText>
                    </div>

                    <div style={{
          background: 'var(--bg-body)',
          padding: '1.15rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginBottom: '1.35rem'
        }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                            {t('business_onboarding_detected_city_label')}
                        </label>
                        <AppTextInput
            type="text"
            readOnly
            tabIndex={-1}
            value={
            areaDetecting && !businessData.city && !businessData.country ?
            '' :
            [businessData.city, businessData.country].filter(Boolean).join(', ') ||
            t('business_onboarding_area_unknown')
            }
            placeholder={
            areaDetecting && !businessData.city && !businessData.country ?
            t('business_onboarding_area_detecting') :
            ''
            }
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: '10px',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
              cursor: 'default'
            }} />

                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>{t('business_signup_business_name_label', 'Business name')}</label>
                        <div style={{ position: 'relative' }}>
                            <FaStore style={fieldIconStyle} />
                            <AppTextInput
              type="text"
              name="businessDisplayName"
              autoComplete="organization"
              value={businessData.businessName}
              onChange={handleBusinessNameChange}
              placeholder=""
              required
              style={inputStyleWithIcon} />

                        </div>
                    </div>

                    <div className="venue-search-stack" style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>{t('business_signup_google_search_label', 'Find your business on Google Maps')}</label>
                        <LocationAutocomplete
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSelect={handlePlaceSelect}
            city={businessData.city}
            countryCode={businessData.countryCode}
            userLat={businessData.userLat}
            userLng={businessData.userLng}
            placeholder=""
            aria-label={t('business_signup_google_search_label', 'Find your business on Google Maps')}
            inputStyle={inputStyleWithIcon}
            useGooglePlacesMinimal />

                    </div>

                    <button type="button" onClick={handleSubmit} disabled={loading} style={btnStyle}>
                        {loading ?
          <>
                                <div className="loader-ring" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                {t('creating_profile', 'Creating profile…')}
                            </> :

          <>
                                {t('create_and_finish', 'Create Business Profile')} <FaCheck />
                            </>
          }
                    </button>
                </div>
      }

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('already_have_account', 'Already have an account?')}{' '}
                    <button type="button" onClick={() => navigate('/login?tab=business')} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', font: 'inherit', fontSize: 'inherit' }}>
                        {t('sign_in', 'Sign in')}
                    </button>
                </AppText>
            </div>
        </BusinessAuthShell>);

};

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  fontSize: '0.9rem',
  fontWeight: '600',
  color: 'var(--text-secondary)'
};

const btnStyle = {
  width: '100%',
  padding: '1rem',
  background: 'linear-gradient(135deg, var(--primary), #f97316)',
  border: 'none',
  borderRadius: '12px',
  color: 'white',
  fontSize: '1.1rem',
  fontWeight: '800',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  boxShadow: '0 4px 15px rgba(232, 110, 46, 0.3)',
  transition: 'all 0.3s ease'
};

export default BusinessSignup;