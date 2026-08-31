import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaLock, FaCheck, FaStore, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  stashBusinessGoogleSignupIntent,
  clearBusinessGoogleSignupIntent,
} from '../utils/businessGoogleSignup';
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
import { lookupBusinessPlace, finalizeBusinessSignup } from '../services/businessPhoneSignupApi';
import './BusinessSignup.css';
import { AppText, AppTextInput } from "./base";

// Business claim by SMS/phone was removed — businesses claim via Google Business
// Profile (see BusinessClaimPanel) or register with email/password. This file now
// only holds the email/password + Google-Place signup flow.
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
  const { signInWithGoogle } = useAuth();
  const [step, setStep] = useState(STEPS.AUTH);
  const [googleBusy, setGoogleBusy] = useState(false);

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

  const looksLikeBusiness = (data) =>
    !!data &&
    (String(data.accountType || '').toLowerCase() === 'business' ||
      String(data.role || '').toLowerCase() === 'partner' ||
      String(data.role || '').toLowerCase() === 'business' ||
      String(data.registrationIntent || '').toLowerCase() === 'business' ||
      data.pendingBusinessRegistration === true ||
      (data.businessInfo && typeof data.businessInfo === 'object' && Object.keys(data.businessInfo).length > 0));

  const hasFullBusinessInfo = (data) =>
    !!data?.businessInfo && typeof data.businessInfo === 'object' && Object.keys(data.businessInfo).length > 0;

  /**
   * "Create business account with Google".
   * - New Google account → the real completion page (/business/onboarding: type,
   *   Google address, Google-Business ownership verification → verified badge).
   * - Existing COMPLETE business → dashboard.
   * - Existing PERSONAL account → REJECTED. We never silently convert a personal
   *   account here; the destructive personal→business conversion lives only in the
   *   explicit "claim your Google Business" flow (with its own double confirmation).
   */
  const handleGoogleBusinessSignup = async () => {
    setGoogleBusy(true);
    stashBusinessGoogleSignupIntent();
    try {
      const res = await signInWithGoogle();
      if (res?.__oauthRedirect) return; // redirect flow: page reloads, resumes on return
      const user = res?.user;
      if (!user?.uid) throw new Error('no-user');

      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? snap.data() : null;

      if (looksLikeBusiness(data) && hasFullBusinessInfo(data)) {
        // Already a complete business → straight to the dashboard.
        clearBusinessGoogleSignupIntent();
        navigate('/business-dashboard', { replace: true });
      } else if (res.isNewUser || looksLikeBusiness(data)) {
        // New Google account (fresh business shell) or a business still finishing
        // registration → the forced completion page (type + address + verify).
        clearBusinessGoogleSignupIntent();
        navigate('/business/onboarding', { replace: true });
      } else {
        // Existing PERSONAL account → reject and keep the accounts separate.
        // Use a BLOCKING alert (not a toast) so the message is never lost to the
        // auth-state-driven navigation that fires right after sign-in — the user
        // must clearly understand that business and personal accounts are separate.
        clearBusinessGoogleSignupIntent();
        const msg = t(
          'business_google_personal_rejected_full',
          "This Google account is already a PERSONAL account on DineBuddies.\n\nBusiness and personal accounts are kept separate. To open a BUSINESS account, use a business email + password, or sign in with a different Google account."
        );
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(msg);
        } else {
          showToast(msg, 'error');
        }
        await signOut(auth).catch(() => {});
      }
    } catch (err) {
      clearBusinessGoogleSignupIntent();
      const code = String(err?.code || '');
      if (code === 'auth/in-app-browser') {
        showToast(t('business_google_open_chrome', 'Open the app in Chrome to sign in with Google.'), 'info');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        /* user closed the popup — no toast */
      } else {
        showToast(t('business_google_signup_failed', 'Google sign-in failed. Please try again.'), 'error');
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const redirectToExistingBusinessClaim = useCallback(
    (restaurantId, businessName = '') => {
      const id = String(restaurantId || '').trim();
      if (!id) return;
      showToast(
        t(
          'business_signup_redirect_claim',
          'This business is already listed. Continue on the claim page to take ownership.'
        ) + (businessName ? ` (${businessName})` : ''),
        'info'
      );
      navigate(`/business/${id}?claim=1`, { replace: true });
    },
    [navigate, showToast, t]
  );

  /** LocationAutocomplete selection payload (Google minimal in business flow). */
  const handlePlaceSelect = useCallback(
    async (place) => {
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
      const placeId = String(place.placeId || '').trim() || null;

      setBusinessData((prev) => ({
        ...prev,
        businessName: prev.businessName.trim() ? prev.businessName : suggestedName || prev.businessName,
        location: fullAddress,
        city: city || prev.city,
        country: country || prev.country,
        countryCode: countryCode || prev.countryCode,
        lat,
        lng,
        placeId,
        phone: (place.phone || '').trim(),
        website: (place.website || '').trim(),
        openingHours: place.openingHours ?? null,
        photos: [],
        rating: place.rating ?? null,
        userRatingsTotal: place.userRatingsTotal ?? null,
        priceLevel: place.priceLevel ?? null,
        businessStatus: place.businessStatus ?? null,
        editorialSummary: (place.editorialSummary || '').trim(),
      }));
      setSearchQuery(fullAddress || suggestedName);

      if (!placeId) {
        showToast(
          t(
            'business_signup_err_place_required',
            'Select your business from Google results (Google Business listing is required).'
          ),
          'error'
        );
        return;
      }

      try {
        const { ok, data } = await lookupBusinessPlace(placeId);
        if (!ok) return;
        if (data?.status === 'claim_flow' && data?.restaurantId) {
          redirectToExistingBusinessClaim(data.restaurantId, data.businessName);
          return;
        }
        if (data?.status === 'already_claimed') {
          showToast(
            t(
              'business_signup_err_place_claimed',
              'This Google Business listing is already claimed on DineBuddies. Sign in with the owner account.'
            ),
            'error'
          );
        }
      } catch (err) {
        console.warn('[BusinessSignup] place lookup failed', err);
      }
    },
    [redirectToExistingBusinessClaim, showToast, t]
  );

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
    const selectedPlaceId = String(businessData.placeId || '').trim();
    if (!selectedPlaceId) {
      showToast(
        t(
          'business_signup_err_place_required',
          'Select your business from Google results (Google Business listing is required).'
        ),
        'error'
      );
      return;
    }
    setLoading(true);

    try {
      const placeLookup = await lookupBusinessPlace(selectedPlaceId);
      if (placeLookup.data?.status === 'claim_flow' && placeLookup.data?.restaurantId) {
        redirectToExistingBusinessClaim(
          placeLookup.data.restaurantId,
          placeLookup.data.businessName
        );
        return;
      }
      if (placeLookup.data?.status === 'already_claimed') {
        showToast(
          t(
            'business_signup_err_place_claimed',
            'This Google Business listing is already claimed on DineBuddies. Sign in with the owner account.'
          ),
          'error'
        );
        return;
      }

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
        placeId: selectedPlaceId,
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
        if (data?.code === 'place-claim-required' && data?.restaurantId) {
          redirectToExistingBusinessClaim(data.restaurantId);
          return;
        }
        if (data?.code === 'place-already-claimed') {
          showToast(
            t(
              'business_signup_err_place_claimed',
              'This Google Business listing is already claimed on DineBuddies. Sign in with the owner account.'
            ),
            'error'
          );
          return;
        }
        if (data?.code === 'place-required') {
          showToast(
            t(
              'business_signup_err_place_required',
              'Select your business from Google results (Google Business listing is required).'
            ),
            'error'
          );
          return;
        }
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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', justifyContent: 'center' }}>
                <div style={{ height: '4px', width: '40px', background: step >= 1 ? 'var(--primary)' : 'var(--border-color)', borderRadius: '2px' }} />
                <div style={{ height: '4px', width: '40px', background: step >= 2 ? 'var(--primary)' : 'var(--border-color)', borderRadius: '2px' }} />
            </div>

            {step === STEPS.AUTH &&
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, var(--primary), #f97316)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontSize: '1.8rem' }}>
                            <HiBuildingStorefront style={{ color: 'white' }} />
                        </div>
                        <AppText as="h1" style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '0.35rem', background: 'linear-gradient(135deg, var(--primary), #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {t('business_signup_title', 'Grow Your Business')}
                        </AppText>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleBusinessSignup}
                      disabled={googleBusy || loading}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.98rem',
                        cursor: googleBusy ? 'not-allowed' : 'pointer', marginBottom: '1rem',
                      }}>
                        <FcGoogle size={20} />
                        {googleBusy ? t('please_wait', 'Please wait…') : t('business_signup_google', 'Create account with Google')}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('or', 'or')}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    </div>

                    <form onSubmit={handleNext}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>{t('email', 'Business Email')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={fieldIconStyle} />
                                <AppTextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyleWithIcon} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>{t('password', 'Password')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={fieldIconStyle} />
                                <AppTextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={inputStyleWithIcon} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1.25rem' }}>
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
                    <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                        <FaChevronLeft /> {t('back', 'Back')}
                    </button>

                    <div style={{ marginBottom: '1rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: 0 }}>
                            {t('business_signup_step2_title', 'Business information')}
                        </AppText>
                    </div>

                    <div style={{
          background: 'var(--bg-body)',
          padding: '0.85rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginBottom: '1rem'
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

                    <div style={{ marginBottom: '1rem' }}>
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

                    <div className="venue-search-stack" style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>
                          {t(
                            'business_signup_google_search_label',
                            'Google Business listing (required)'
                          )}
                        </label>
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

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
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