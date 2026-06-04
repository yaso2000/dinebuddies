import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaLock, FaCheck, FaStore, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { sendVerificationEmailResend, verificationEmailErrorMessage } from '../services/verificationEmailService';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import BusinessAuthShell from '../pages/auth/BusinessAuthShell';
import LocationAutocomplete from './LocationAutocomplete';
import { parseGoogleAddressComponents } from '../utils/googlePlacesBusiness';
import {
    ENABLE_BACKGROUND_AREA_DETECT,
    GEOLOCATION_OPTIONS,
    detectCityCountryInBackground,
} from '../utils/bigDataCloudGeocode';
import {
    peekPendingReferralCode,
    clearPendingReferralCode,
    syncPendingReferralFromQueryString,
} from '../utils/pendingReferral';
import {
    formatToE164,
    isValidE164,
    defaultDialCodeForCountryIso,
    cleanedPhoneLength,
    toCountryCodeSelectValue,
} from '../utils/phoneUtils';
import { PHONE_COUNTRY_OPTIONS } from '../constants/phoneCountryCodes';
import { sendBusinessOtp, verifyBusinessOtp, completeBusinessSignup } from '../services/businessPhoneOtpApi';
import { FaPhone } from 'react-icons/fa';
import './BusinessSignup.css';

const OTP_LENGTH = 6;
const SEND_COOLDOWN_SEC = 60;

/**
 * حقول الهاتف + OTP + العد التنازلي (مطابق لتدفق send-business-otp).
 * @param {{ defaultDialCode?: string, disabled?: boolean, lockFieldsAfterSend?: boolean, onVerified: Function }} props
 */
export function BusinessPhoneFields({ defaultDialCode, disabled, lockFieldsAfterSend = true, onVerified }) {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';

    const [countryCode, setCountryCode] = useState(() => toCountryCodeSelectValue(defaultDialCode || '20'));
    const [rawPhone, setRawPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [flowType, setFlowType] = useState('new_register_flow');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [standardizedPhone, setStandardizedPhone] = useState('');
    const [claimMeta, setClaimMeta] = useState(null);

    const standardizedPreview = useMemo(
        () => formatToE164(countryCode, rawPhone),
        [countryCode, rawPhone]
    );

    useEffect(() => {
        setCountryCode(toCountryCodeSelectValue(defaultDialCode || '20'));
    }, [defaultDialCode]);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const fieldsLocked = disabled || phoneVerified || (lockFieldsAfterSend && isOtpSent);

    const handleSendOTP = async (e) => {
        e?.preventDefault?.();
        setErrorMessage('');

        const standardized = formatToE164(countryCode, rawPhone);
        if (!standardized || cleanedPhoneLength(rawPhone) < 7 || !isValidE164(standardized)) {
            setErrorMessage(t('business_phone_invalid', 'يرجى إدخال رقم هاتف صحيح'));
            return;
        }

        setCountdown(SEND_COOLDOWN_SEC);
        setSending(true);
        showToast(t('business_phone_sending', 'جاري إرسال رمز التحقق…'), 'info');

        try {
            const { ok, data } = await sendBusinessOtp({
                standardizedPhone: standardized,
                countryCode,
                rawPhone,
            });

            if (!ok) {
                setErrorMessage(
                    data?.message ||
                        t('business_phone_send_failed', 'فشل إرسال الكود')
                );
                setCountdown(0);
                return;
            }

            setStandardizedPhone(data.standardizedPhone || standardized);
            setIsOtpSent(true);
            const status = data.status || (data.flow === 'claim' ? 'claim_flow' : 'new_register_flow');
            setFlowType(status);

            if (status === 'claim_flow') {
                setClaimMeta({
                    businessId: data.businessId,
                    businessName: data.businessName,
                });
            } else {
                setClaimMeta(null);
            }

            if (data.message) {
                showToast(data.message, 'info');
            }
        } catch {
            setErrorMessage(t('business_phone_send_failed', 'حدث خطأ بالاتصال بالسيرفر'));
            setCountdown(0);
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = useCallback(async () => {
        const code = otpCode.replace(/\D/g, '');
        if (code.length < OTP_LENGTH || !standardizedPhone) {
            setErrorMessage(t('business_phone_code_invalid', 'رمز التحقق غير صحيح'));
            return;
        }
        setErrorMessage('');
        setVerifying(true);
        try {
            const { ok, data } = await verifyBusinessOtp({ standardizedPhone, code });
            if (!ok) {
                setErrorMessage(
                    data?.message || t('business_phone_code_invalid', 'رمز التحقق غير صحيح')
                );
                return;
            }
            setPhoneVerified(true);
            const flow =
                flowType === 'claim_flow' || data.flow === 'claim' ? 'claim' : 'new';
            onVerified({
                standardizedPhone: data.standardizedPhone || standardizedPhone,
                verificationToken: data.verificationToken,
                flow,
                businessId: data.businessId || claimMeta?.businessId,
                businessName: data.businessName || claimMeta?.businessName,
            });
            showToast(t('business_phone_verified', 'تم التحقق من الهاتف'), 'success');
        } catch {
            setErrorMessage(t('business_phone_verify_failed', 'فشل التحقق'));
        } finally {
            setVerifying(false);
        }
    }, [otpCode, standardizedPhone, flowType, claimMeta, onVerified, showToast, t]);

    const sendBtnDisabled =
        disabled || sending || countdown > 0 || (lockFieldsAfterSend && isOtpSent) || phoneVerified;

    return (
        <div className="biz-phone-verify signup-phone-block" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="biz-phone-verify__row">
                <label className="biz-phone-verify__label">
                    {t('business_phone_label', 'رقم الهاتف التجاري')}
                </label>
                <div className="biz-phone-verify__inputs">
                    <select
                        className="biz-phone-verify__country"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        disabled={fieldsLocked}
                        aria-label={t('business_phone_country_code', 'رمز الدولة')}
                    >
                        {PHONE_COUNTRY_OPTIONS.map((c) => (
                            <option key={c.iso} value={`+${c.dial}`}>
                                {c.labelFallback} (+{c.dial})
                            </option>
                        ))}
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
                            disabled={fieldsLocked}
                        />
                    </div>
                </div>
            </div>

            {errorMessage && (
                <p className="biz-phone-verify__error" role="alert">
                    {errorMessage}
                </p>
            )}

            {/* type="button" — لا form متداخل؛ form الأب (handleNext) كان يمنع طلب send-business-otp */}
            <button
                type="button"
                className="biz-phone-verify__send-btn"
                disabled={sendBtnDisabled}
                onClick={handleSendOTP}
            >
                {sending
                    ? t('sending', 'جاري الإرسال…')
                    : countdown > 0
                      ? t('business_phone_resend_in', 'إعادة الإرسال خلال ({{sec}}ث)', {
                            sec: countdown,
                        })
                      : t('send_code', 'إرسال كود التحقق عبر SMS')}
            </button>

            {phoneVerified && (
                <p className="biz-phone-verify__verified">
                    {t('business_phone_verified', 'تم التحقق')} ({standardizedPhone})
                </p>
            )}

            {isOtpSent && !phoneVerified && (
                <div className="biz-phone-verify__otp-block">
                    <h3 className="biz-phone-verify__otp-title">
                        {t('business_phone_otp_hint', 'أدخل كود التحقق المستلم')}
                    </h3>
                    <p className="biz-phone-verify__otp-flow-msg">
                        {flowType === 'claim_flow'
                            ? t(
                                  'business_phone_claim_otp_hint',
                                  '⚠️ هذا النشاط موجود مسبقاً، أدخل الكود لنقله لملكيتك.'
                              )
                            : t(
                                  'business_phone_new_otp_hint',
                                  'يرجى تأكيد الحساب الجديد.'
                              )}
                    </p>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={OTP_LENGTH}
                        className="biz-phone-verify__otp-single"
                        placeholder="******"
                        value={otpCode}
                        onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))
                        }
                    />
                    <button
                        type="button"
                        className="biz-phone-verify__verify-btn"
                        disabled={verifying || otpCode.replace(/\D/g, '').length < OTP_LENGTH}
                        onClick={handleVerifyOtp}
                    >
                        {verifying
                            ? t('verifying', 'جاري التحقق…')
                            : t('business_phone_confirm_otp', 'تأكيد الكود ومتابعة التسجيل')}
                    </button>
                </div>
            )}
        </div>
    );
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
        ...(isRtl ? { right: '1rem', left: 'auto' } : { left: '1rem', right: 'auto' }),
    };
    const inputStyleWithIcon = {
        width: '100%',
        padding: isRtl ? '0.9rem 3rem 0.9rem 1rem' : '0.9rem 1rem 0.9rem 3rem',
        background: 'var(--bg-body)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        boxSizing: 'border-box',
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
    const [phoneVerification, setPhoneVerification] = useState(null);

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
        editorialSummary: '',
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
                    geolocationOptions: GEOLOCATION_OPTIONS,
                });
                if (!mounted) return;
                setBusinessData((prev) => ({
                    ...prev,
                    userLat: detected.lat ?? prev.userLat,
                    userLng: detected.lng ?? prev.userLng,
                    countryCode: detected.countryCode || prev.countryCode,
                    country: detected.countryName || prev.country,
                    ...(detected.city ? { city: detected.city } : {}),
                }));
            } finally {
                if (mounted) setAreaDetecting(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const defaultDialCode = defaultDialCodeForCountryIso(businessData.countryCode || 'EG');

    const validateAuth = () => {
        if (!phoneVerification?.standardizedPhone || !phoneVerification?.verificationToken) {
            showToast(t('business_phone_verify_required', 'Verify your business phone number first'), 'error');
            return false;
        }
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

    const handleNext = (e) => {
        e.preventDefault();
        if (validateAuth()) {
            setStep(STEPS.DETAILS);
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
            businessName: prev.businessName.trim() ? prev.businessName : (suggestedName || prev.businessName),
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
            editorialSummary: (place.editorialSummary || '').trim(),
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
        if (!phoneVerification?.standardizedPhone || !phoneVerification?.verificationToken) {
            showToast(t('business_phone_verify_required', 'Verify your business phone number first'), 'error');
            return;
        }

        setLoading(true);

        try {
            const businessInfo = {
                businessName: businessData.businessName.trim(),
                businessType: businessData.businessType,
                phone: businessData.phone || phoneVerification.standardizedPhone,
                standardized_phone: phoneVerification.standardizedPhone,
                isClaimed: true,
                phone_verified: true,
                phone_claimed: true,
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
                isPublished: false,
            };

            const pendingReferral = peekPendingReferralCode();
            const { ok, data } = await completeBusinessSignup({
                standardizedPhone: phoneVerification.standardizedPhone,
                verificationToken: phoneVerification.verificationToken,
                email: email.trim(),
                password,
                businessInfo,
                claimBusinessId:
                    phoneVerification.flow === 'claim' ? phoneVerification.businessId || null : null,
                referredBy: pendingReferral || null,
            });

            if (!ok) {
                const msg = data?.message || t('business_signup_err_create', 'Failed to create account.');
                if (data?.code === 'auth/email-already-in-use') {
                    showToast(t('auth_email_in_use', 'This email is already registered'), 'error');
                    setStep(STEPS.AUTH);
                } else if (data?.code === 'phone-already-in-use') {
                    showToast(t('business_phone_in_use', 'This phone is already registered to a business'), 'error');
                    setStep(STEPS.AUTH);
                } else if (data?.code === 'verification-expired') {
                    showToast(t('business_phone_verify_required', 'Verify your business phone number first'), 'error');
                    setStep(STEPS.AUTH);
                } else {
                    showToast(msg, 'error');
                }
                return;
            }

            if (pendingReferral) clearPendingReferralCode();

            await signInWithEmailAndPassword(auth, email.trim(), password);
            const uid = data.uid;

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
                state: { businessSignupNeedsVerify: true },
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

            {step === STEPS.AUTH && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, var(--primary), #f97316)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem' }}>
                            <HiBuildingStorefront style={{ color: 'white' }} />
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.5rem', background: 'linear-gradient(135deg, var(--primary), #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {t('business_signup_title', 'Grow Your Business')}
                        </h1>
                    </div>

                    <BusinessPhoneFields
                        defaultDialCode={defaultDialCode || '61'}
                        onVerified={(payload) => setPhoneVerification(payload)}
                    />

                    <form onSubmit={handleNext}>
                        <div style={{ marginBottom: '1.25rem', opacity: phoneVerification ? 1 : 0.55 }}>
                            <label style={labelStyle}>{t('email', 'Business Email')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={fieldIconStyle} />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!phoneVerification} style={inputStyleWithIcon} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>{t('password', 'Password')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={fieldIconStyle} />
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={!phoneVerification} style={inputStyleWithIcon} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={labelStyle}>{t('confirm_password', 'Confirm Password')}</label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={fieldIconStyle} />
                                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} disabled={!phoneVerification} style={inputStyleWithIcon} />
                            </div>
                        </div>

                        <button type="submit" style={btnStyle} disabled={!phoneVerification}>
                            {t('next', 'Next Step')} <FaChevronRight size={14} />
                        </button>
                    </form>
                </div>
            )}

            {step === STEPS.DETAILS && (
                <div style={{ animation: 'slideInRight 0.4s ease-out' }}>
                    <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        <FaChevronLeft /> {t('back', 'Back')}
                    </button>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: 0 }}>
                            {t('business_signup_step2_title', 'Business information')}
                        </h2>
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
                        <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={
                                areaDetecting && !businessData.city && !businessData.country
                                    ? ''
                                    : [businessData.city, businessData.country].filter(Boolean).join(', ') ||
                                      t('business_onboarding_area_unknown')
                            }
                            placeholder={
                                areaDetecting && !businessData.city && !businessData.country
                                    ? t('business_onboarding_area_detecting')
                                    : ''
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
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>{t('business_signup_business_name_label', 'Business name')}</label>
                        <div style={{ position: 'relative' }}>
                            <FaStore style={fieldIconStyle} />
                            <input
                                type="text"
                                name="businessDisplayName"
                                autoComplete="organization"
                                value={businessData.businessName}
                                onChange={handleBusinessNameChange}
                                placeholder=""
                                required
                                style={inputStyleWithIcon}
                            />
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
                            useGooglePlacesMinimal
                        />
                    </div>

                    <button type="button" onClick={handleSubmit} disabled={loading} style={btnStyle}>
                        {loading ? (
                            <>
                                <div className="loader-ring" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                {t('creating_profile', 'Creating profile…')}
                            </>
                        ) : (
                            <>
                                {t('create_and_finish', 'Create Business Profile')} <FaCheck />
                            </>
                        )}
                    </button>
                </div>
            )}

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('already_have_account', 'Already have an account?')}{' '}
                    <button type="button" onClick={() => navigate('/login?tab=business')} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', font: 'inherit', fontSize: 'inherit' }}>
                        {t('sign_in', 'Sign in')}
                    </button>
                </p>
            </div>
        </BusinessAuthShell>
    );
};

const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
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
