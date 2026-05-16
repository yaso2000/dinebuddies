import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    updateProfile,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../firebase/config';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { sendVerificationEmailResend } from '../../services/verificationEmailService';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import { parseGoogleAddressComponents } from '../../utils/googlePlacesBusiness';
import AffiliatePublicRouteAccountGuard from '../../components/AffiliatePublicRouteAccountGuard';
import { isMobileRestrictedShell, subscribeMobileRestrictedShell } from '../../utils/mobileAppShell';
import { getAffiliateEmailSignInHref } from '../../utils/affiliateAuthRoutes';
import './AffiliateDashboard.css';
import '../../components/venue-search.css';

const FUNCTIONS_REGION = 'us-central1';

export default function AffiliateSignupPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [paypalEmail, setPaypalEmail] = useState('');

    const [mobileShell, setMobileShell] = useState(() =>
        typeof window !== 'undefined' ? isMobileRestrictedShell() : false
    );
    useEffect(() => {
        setMobileShell(isMobileRestrictedShell());
        return subscribeMobileRestrictedShell(setMobileShell);
    }, []);

    const mapsInputStyle = {
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-input)',
        color: 'var(--text-main)',
        fontSize: '0.95rem',
    };

    const handlePlaceSelect = useCallback((place) => {
        const fullAddress = (place.fullAddress || place.name || '').trim();
        let nextCity = '';
        let nextCountry = '';
        let nextCc = '';
        if (place.addressComponents) {
            const p = parseGoogleAddressComponents(place.addressComponents);
            nextCity = p.city || '';
            nextCountry = p.country || '';
            nextCc = p.countryCode || '';
        }
        if (!nextCity && fullAddress) {
            nextCity = fullAddress.split(',')[0]?.trim() || '';
        }
        setCity(nextCity);
        setCountry(nextCountry);
        setCountryCode(nextCc);
        setLocationSearch(fullAddress || [nextCity, nextCountry].filter(Boolean).join(', '));
    }, []);

    const clearLocation = useCallback(() => {
        setCountry('');
        setCity('');
        setCountryCode('');
        setLocationSearch('');
    }, []);

    const onSubmit = async (e) => {
        e.preventDefault();
        const em = email.trim().toLowerCase();
        if (!em || !password) {
            showToast(t('affiliate_auth_err_required', 'Please fill email and password.'), 'error');
            return;
        }
        if (password.length < 6) {
            showToast(t('password_min_6_chars', 'Password must be at least 6 characters'), 'error');
            return;
        }
        if (password !== password2) {
            showToast(t('affiliate_auth_err_password_match', 'Passwords do not match.'), 'error');
            return;
        }
        if (!displayName.trim() || !phone.trim() || !paypalEmail.trim()) {
            showToast(t('affiliate_auth_err_profile_fields', 'Please complete all contact and payout fields.'), 'error');
            return;
        }
        if (!locationSearch.trim() || !country.trim() || !city.trim()) {
            showToast(
                t('affiliate_signup_maps_required', 'Search Google Maps and pick a place to set your city and country.'),
                'error'
            );
            return;
        }

        setLoading(true);
        const auth = getAuth(app);
        try {
            const cred = await createUserWithEmailAndPassword(auth, em, password);
            try {
                await updateProfile(cred.user, { displayName: displayName.trim() });
            } catch {
                /* non-fatal */
            }

            const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'registerAffiliateAgentProfile');
            await fn({
                displayName: displayName.trim(),
                phone: phone.trim(),
                country: country.trim(),
                city: city.trim(),
                paypalEmail: paypalEmail.trim(),
            });

            try {
                await sendVerificationEmailResend('affiliate_signup');
            } catch (verErr) {
                console.warn('affiliate signup verification email:', verErr?.message || verErr);
            }

            showToast(t('affiliate_signup_success', 'Your affiliate account is ready.'), 'success');
            navigate('/affiliate/dashboard', { replace: true });
        } catch (err) {
            try {
                if (auth.currentUser) {
                    await deleteUser(auth.currentUser);
                }
            } catch {
                /* ignore */
            }
            const fnMsg =
                err?.code && String(err.code).startsWith('functions/') && typeof err.message === 'string'
                    ? err.message.trim()
                    : '';
            const msg =
                fnMsg ||
                getAuthErrorMessage(err) ||
                err?.message ||
                t('affiliate_signup_failed', 'Could not complete signup.');
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (mobileShell) {
        return (
            <AffiliatePublicRouteAccountGuard>
                <div className="affiliate-shell affiliate-shell--center">
                    <div className="affiliate-card" style={{ maxWidth: 480, width: '100%' }}>
                        <h1 className="affiliate-h1">{t('affiliate_signup_title', 'Affiliate registration')}</h1>
                        <p className="affiliate-muted" style={{ marginBottom: 16, lineHeight: 1.55 }}>
                            {t(
                                'affiliate_signup_desktop_only',
                                'Creating a new affiliate account is only supported on a desktop or laptop browser. Please open this page on a computer to continue.'
                            )}
                        </p>
                        <div className="affiliate-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <Link
                                to={getAffiliateEmailSignInHref('/affiliate/dashboard')}
                                className="affiliate-btn affiliate-btn--primary"
                            >
                                {t('affiliate_portal_cta_login', 'Sign in')}
                            </Link>
                            <Link to="/affiliate" className="affiliate-btn affiliate-btn--ghost">
                                {t('affiliate_back_home', 'Back to home')}
                            </Link>
                        </div>
                        <p className="affiliate-muted" style={{ marginTop: 14, fontSize: '0.82rem' }}>
                            <Link to="/affiliate/sign-out">{t('affiliate_sign_out_escape_link', 'Session stuck? Sign out here')}</Link>
                        </p>
                    </div>
                </div>
            </AffiliatePublicRouteAccountGuard>
        );
    }

    return (
        <AffiliatePublicRouteAccountGuard blockRedirect={loading}>
        <div className="affiliate-shell affiliate-shell--center">
            <div className="affiliate-card affiliate-auth-card" style={{ maxWidth: 480, width: '100%' }}>
                <h1 className="affiliate-h1">{t('affiliate_signup_title', 'Affiliate registration')}</h1>
                <p className="affiliate-muted" style={{ marginBottom: 20 }}>
                    {t(
                        'affiliate_signup_intro',
                        'Create a partner account with email and password only. PayPal is used for future payouts.'
                    )}
                </p>
                <form className="affiliate-auth-form" onSubmit={onSubmit}>
                    <label className="affiliate-auth-label">{t('affiliate_auth_email', 'Email')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        required
                    />

                    <label className="affiliate-auth-label">{t('affiliate_auth_password', 'Password')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        required
                        minLength={6}
                    />

                    <label className="affiliate-auth-label">{t('affiliate_auth_password_confirm', 'Confirm password')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="password"
                        autoComplete="new-password"
                        value={password2}
                        onChange={(ev) => setPassword2(ev.target.value)}
                        required
                        minLength={6}
                    />

                    <label className="affiliate-auth-label">{t('affiliate_auth_display_name', 'Full name')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="text"
                        autoComplete="name"
                        value={displayName}
                        onChange={(ev) => setDisplayName(ev.target.value)}
                        required
                    />

                    <label className="affiliate-auth-label">{t('affiliate_auth_phone', 'Phone number')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(ev) => setPhone(ev.target.value)}
                        required
                    />

                    <div className="venue-search-stack" style={{ marginTop: 4 }}>
                        <label className="affiliate-auth-label">
                            {t('affiliate_signup_maps_label', 'City & country (Google Maps)')}
                        </label>
                        <p className="affiliate-muted" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
                            {t(
                                'affiliate_signup_maps_hint',
                                'Type a city or address, then choose a result to fill country and city automatically.'
                            )}
                        </p>
                        <LocationAutocomplete
                            value={locationSearch}
                            onChange={(e) => setLocationSearch(e.target.value)}
                            onSelect={handlePlaceSelect}
                            city={city}
                            countryCode={countryCode}
                            useGooglePlacesMinimal
                            inputStyle={mapsInputStyle}
                            placeholder={t('affiliate_signup_maps_placeholder', 'e.g. Dubai, London, Sydney…')}
                            aria-label={t('affiliate_signup_maps_label', 'City & country (Google Maps)')}
                        />
                        {(country || city) && (
                            <div
                                style={{
                                    marginTop: 10,
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 10,
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span className="affiliate-muted" style={{ fontSize: '0.9rem' }}>
                                    <strong>{t('affiliate_signup_maps_selected', 'Selected')}:</strong>{' '}
                                    {[city, country].filter(Boolean).join(', ') || '—'}
                                </span>
                                <button type="button" className="affiliate-btn affiliate-btn--ghost" onClick={clearLocation}>
                                    {t('affiliate_signup_maps_clear', 'Clear')}
                                </button>
                            </div>
                        )}
                    </div>

                    <label className="affiliate-auth-label">{t('affiliate_auth_paypal', 'PayPal email')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="name@example.com"
                        value={paypalEmail}
                        onChange={(ev) => setPaypalEmail(ev.target.value)}
                        required
                    />

                    <button type="submit" className="affiliate-btn affiliate-btn--primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                        {loading ? t('affiliate_auth_submitting', 'Please wait…') : t('affiliate_signup_submit', 'Create affiliate account')}
                    </button>
                </form>
                <p className="affiliate-muted" style={{ marginTop: 18, fontSize: '0.9rem' }}>
                    {t('affiliate_auth_has_account', 'Already have an account?')}{' '}
                    <Link to={getAffiliateEmailSignInHref('/affiliate/dashboard')}>{t('affiliate_login_link', 'Sign in')}</Link>
                </p>
                <p style={{ marginTop: 12 }}>
                    <Link to="/affiliate" className="affiliate-muted">
                        {t('affiliate_back_home', 'Back to home')}
                    </Link>
                </p>
                <p className="affiliate-muted" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    <Link to="/affiliate/sign-out">{t('affiliate_sign_out_escape_link', 'Session stuck? Sign out here')}</Link>
                </p>
            </div>
        </div>
        </AffiliatePublicRouteAccountGuard>
    );
}
