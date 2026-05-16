import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase/config';
import { isAffiliateAgent } from '../../utils/accountRole';
import { getAffiliateEmailSignInHref } from '../../utils/affiliateAuthRoutes';
import AppRouteLoading from '../../components/AppRouteLoading';
import { useToast } from '../../context/ToastContext';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import { parseGoogleAddressComponents } from '../../utils/googlePlacesBusiness';
import { FaSignOutAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import './AffiliateDashboard.css';
import '../../components/venue-search.css';

function validatePaypalEmail(s) {
    const t = String(s || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
    return t.slice(0, 120);
}

function hasEmailPasswordProvider(user) {
    if (!user?.providerData?.length) return false;
    return user.providerData.some((p) => p.providerId === 'password');
}

export default function AffiliateSettingsPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { currentUser, userProfile, loading, profileServerSynced, signOut, deleteUserAccount } = useAuth();
    const [phone, setPhone] = useState('');
    const [paypal, setPaypal] = useState('');
    const [address, setAddress] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [saving, setSaving] = useState(false);

    const [notifyBusiness, setNotifyBusiness] = useState(true);
    const [notifyPlan, setNotifyPlan] = useState(true);
    const [savingNotify, setSavingNotify] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCur, setShowCur] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConf, setShowConf] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdError, setPwdError] = useState('');

    const [deletePhrase, setDeletePhrase] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

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

    const clearLocation = () => {
        setCountry('');
        setCity('');
        setCountryCode('');
        setLocationSearch('');
    };

    useEffect(() => {
        if (!userProfile) return;
        setPhone(String(userProfile.affiliate_phone || '').trim());
        setPaypal(String(userProfile.affiliate_paypal_email || '').trim());
        setAddress(String(userProfile.affiliate_address || '').trim());
        const c = String(userProfile.affiliate_city || '').trim();
        const co = String(userProfile.affiliate_country || '').trim();
        const cc = String(userProfile.countryCode || '').trim();
        setCity(c);
        setCountry(co);
        setCountryCode(cc);
        if (c || co) {
            setLocationSearch([c, co].filter(Boolean).join(', '));
        } else {
            setLocationSearch('');
        }
        setNotifyBusiness(userProfile.affiliate_notify_referral_business !== false);
        setNotifyPlan(userProfile.affiliate_notify_referral_plan !== false);
    }, [userProfile]);

    const persistNotifyPrefs = async (nextBusiness, nextPlan, revert) => {
        if (!currentUser) return;
        setSavingNotify(true);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                affiliate_notify_referral_business: !!nextBusiness,
                affiliate_notify_referral_plan: !!nextPlan,
            });
            showToast(t('affiliate_settings_saved', 'Settings saved.'), 'success');
        } catch (err) {
            console.warn('[AffiliateSettings] notify', err?.code, err?.message);
            if (typeof revert === 'function') revert();
            showToast(err?.message || t('affiliate_settings_save_failed', 'Could not save settings.'), 'error');
        } finally {
            setSavingNotify(false);
        }
    };

    const onToggleBusiness = async () => {
        const prevB = notifyBusiness;
        const prevP = notifyPlan;
        const v = !prevB;
        setNotifyBusiness(v);
        await persistNotifyPrefs(v, notifyPlan, () => {
            setNotifyBusiness(prevB);
            setNotifyPlan(prevP);
        });
    };

    const onTogglePlan = async () => {
        const prevB = notifyBusiness;
        const prevP = notifyPlan;
        const v = !prevP;
        setNotifyPlan(v);
        await persistNotifyPrefs(notifyBusiness, v, () => {
            setNotifyBusiness(prevB);
            setNotifyPlan(prevP);
        });
    };

    if (loading) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    if (!currentUser) {
        return <Navigate to={getAffiliateEmailSignInHref('/affiliate/settings')} replace />;
    }

    if (!profileServerSynced) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    if (!userProfile || !isAffiliateAgent(userProfile)) {
        return <Navigate to="/" replace />;
    }

    const onSave = async (e) => {
        e.preventDefault();
        const p = String(phone || '').replace(/[^\d+()\s-]/g, '').trim();
        if (p.length < 8 || p.length > 32) {
            showToast(t('affiliate_settings_phone_invalid', 'Enter a valid phone number.'), 'error');
            return;
        }
        const pay = validatePaypalEmail(paypal);
        if (!pay) {
            showToast(t('affiliate_settings_paypal_invalid', 'Enter a valid PayPal email.'), 'error');
            return;
        }
        const addr = String(address || '').trim().slice(0, 500);
        if (addr.length < 3) {
            showToast(t('affiliate_settings_address_invalid', 'Please enter your mailing address.'), 'error');
            return;
        }
        const co = String(country || '').trim().slice(0, 80);
        const ci = String(city || '').trim().slice(0, 80);
        if (!co || !ci) {
            showToast(
                t('affiliate_signup_maps_required', 'Search Google Maps and pick a place to set your city and country.'),
                'error'
            );
            return;
        }

        const cc = String(countryCode || '').trim().slice(0, 8);

        setSaving(true);
        try {
            const payload = {
                affiliate_phone: p,
                affiliate_paypal_email: pay,
                affiliate_address: addr,
                affiliate_country: co,
                affiliate_city: ci,
                affiliate_notify_referral_business: !!notifyBusiness,
                affiliate_notify_referral_plan: !!notifyPlan,
            };
            if (cc) payload.countryCode = cc;
            await updateDoc(doc(db, 'users', currentUser.uid), payload);
            showToast(t('affiliate_settings_saved', 'Settings saved.'), 'success');
        } catch (err) {
            console.warn('[AffiliateSettings]', err?.code, err?.message);
            showToast(err?.message || t('affiliate_settings_save_failed', 'Could not save settings.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const onChangePassword = async (e) => {
        e.preventDefault();
        setPwdError('');
        if (newPassword !== confirmPassword) {
            setPwdError(t('error_passwords_match', 'New passwords do not match'));
            return;
        }
        if (newPassword.length < 6) {
            setPwdError(t('error_password_length', 'Password must be at least 6 characters'));
            return;
        }
        const u = auth.currentUser;
        if (!u?.email) {
            setPwdError(t('affiliate_password_no_email', 'No email on this session.'));
            return;
        }
        setPwdLoading(true);
        try {
            const credential = EmailAuthProvider.credential(u.email, currentPassword);
            await reauthenticateWithCredential(u, credential);
            await updatePassword(u, newPassword);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            showToast(t('affiliate_password_updated', 'Password updated.'), 'success');
        } catch (err) {
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setPwdError(t('error_current_password', 'Current password is incorrect'));
            } else if (err.code === 'auth/weak-password') {
                setPwdError(t('error_weak_password', 'Password is too weak'));
            } else {
                setPwdError(t('error_update_password', 'Failed to update password. Please try again.'));
            }
        } finally {
            setPwdLoading(false);
        }
    };

    const confirmWord = t('affiliate_delete_confirm_word', 'DELETE');

    const onDeleteAccount = async (e) => {
        e.preventDefault();
        setDeleteError('');
        if (deletePhrase.trim() !== confirmWord) {
            setDeleteError(t('affiliate_delete_phrase_mismatch', 'Type the confirmation word exactly.'));
            return;
        }
        if (!deletePassword) {
            setDeleteError(t('affiliate_delete_password_required', 'Enter your password to confirm.'));
            return;
        }
        setDeleteLoading(true);
        try {
            await deleteUserAccount({ password: deletePassword });
            showToast(t('affiliate_account_deleted', 'Your account was deleted.'), 'success');
            window.location.replace('/affiliate');
        } catch (err) {
            if (err?.code === 'auth/requires-recent-login') {
                setDeleteError(t('affiliate_delete_reauth', 'Sign out and sign in again, then retry.'));
            } else {
                setDeleteError(err?.message || t('affiliate_delete_failed', 'Could not delete account.'));
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    const emailPw = hasEmailPasswordProvider(currentUser);

    return (
        <div className="affiliate-shell">
            <div className="affiliate-dash" style={{ maxWidth: 560 }}>
                <header className="affiliate-header">
                    <div>
                        <h1>{t('affiliate_settings_title', 'Affiliate settings')}</h1>
                        <p className="affiliate-sub">
                            {t(
                                'affiliate_settings_sub',
                                'Payout details, notifications, password, and account deletion. Balances are managed by the system.'
                            )}
                        </p>
                    </div>
                    <div className="affiliate-header-actions">
                        <Link to="/affiliate/dashboard" className="affiliate-btn affiliate-btn--secondary">
                            {t('affiliate_settings_back_dashboard', 'Back to dashboard')}
                        </Link>
                        <button
                            type="button"
                            className="affiliate-btn affiliate-btn--ghost"
                            onClick={() => signOut('/affiliate')}
                        >
                            <FaSignOutAlt aria-hidden />
                            {t('logout', 'Log out')}
                        </button>
                    </div>
                </header>

                <div className="affiliate-card" style={{ marginTop: 8 }}>
                    <h2 className="affiliate-h2" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                        {t('affiliate_notify_section_title', 'Referral notifications')}
                    </h2>
                    <p className="affiliate-muted" style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
                        {t(
                            'affiliate_notify_section_hint',
                            'Choose which in-app alerts you want when referred users take key actions.'
                        )}
                    </p>
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            marginBottom: 14,
                            cursor: savingNotify ? 'wait' : 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={notifyBusiness}
                            disabled={savingNotify}
                            onChange={onToggleBusiness}
                        />
                        <span>
                            <strong>{t('affiliate_notify_business_label', 'Business signup')}</strong>
                            <br />
                            <span className="affiliate-muted" style={{ fontSize: '0.88rem' }}>
                                {t(
                                    'affiliate_notify_business_desc',
                                    'When someone you referred completes a business profile.'
                                )}
                            </span>
                        </span>
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            cursor: savingNotify ? 'wait' : 'pointer',
                        }}
                    >
                        <input type="checkbox" checked={notifyPlan} disabled={savingNotify} onChange={onTogglePlan} />
                        <span>
                            <strong>{t('affiliate_notify_plan_label', 'Plan purchase')}</strong>
                            <br />
                            <span className="affiliate-muted" style={{ fontSize: '0.88rem' }}>
                                {t(
                                    'affiliate_notify_plan_desc',
                                    'When a referred user pays for a business subscription (commission applies).'
                                )}
                            </span>
                        </span>
                    </label>
                </div>

                <div className="affiliate-card" style={{ marginTop: 12 }}>
                    <form className="affiliate-auth-form" onSubmit={onSave}>
                        <label className="affiliate-auth-label">{t('affiliate_auth_phone', 'Phone number')}</label>
                        <input
                            className="affiliate-auth-input"
                            type="tel"
                            value={phone}
                            onChange={(ev) => setPhone(ev.target.value)}
                            autoComplete="tel"
                            required
                        />

                        <div className="venue-search-stack" style={{ marginTop: 4 }}>
                            <label className="affiliate-auth-label">
                                {t('affiliate_signup_maps_label', 'City & country (Google Maps)')}
                            </label>
                            <p className="affiliate-muted" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
                                {t(
                                    'affiliate_settings_maps_hint',
                                    'Pick a place to update city and country, or keep the values shown below.'
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
                            value={paypal}
                            onChange={(ev) => setPaypal(ev.target.value)}
                            autoComplete="email"
                            required
                        />

                        <label className="affiliate-auth-label">{t('affiliate_settings_address', 'Mailing address')}</label>
                        <textarea
                            className="affiliate-auth-input"
                            rows={4}
                            value={address}
                            onChange={(ev) => setAddress(ev.target.value)}
                            style={{ resize: 'vertical', minHeight: 100 }}
                            required
                        />

                        <button type="submit" className="affiliate-btn affiliate-btn--primary" disabled={saving} style={{ marginTop: 16 }}>
                            {saving ? t('affiliate_auth_submitting', 'Please wait…') : t('affiliate_settings_save', 'Save changes')}
                        </button>
                    </form>
                </div>

                {emailPw && (
                    <div className="affiliate-card" style={{ marginTop: 12 }}>
                        <h2 className="affiliate-h2" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                            {t('affiliate_password_section_title', 'Change password')}
                        </h2>
                        <form className="affiliate-auth-form" onSubmit={onChangePassword}>
                            <label className="affiliate-auth-label">{t('current_password', 'Current password')}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="affiliate-auth-input"
                                    type={showCur ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    disabled={pwdLoading}
                                    style={{ paddingRight: 44 }}
                                />
                                <button
                                    type="button"
                                    className="affiliate-btn affiliate-btn--ghost"
                                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', minWidth: 36 }}
                                    onClick={() => setShowCur(!showCur)}
                                    aria-label={t('toggle_password_visibility', 'Show password')}
                                >
                                    {showCur ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            <label className="affiliate-auth-label">{t('new_password', 'New password')}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="affiliate-auth-input"
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                    minLength={6}
                                    disabled={pwdLoading}
                                    style={{ paddingRight: 44 }}
                                />
                                <button
                                    type="button"
                                    className="affiliate-btn affiliate-btn--ghost"
                                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', minWidth: 36 }}
                                    onClick={() => setShowNew(!showNew)}
                                    aria-label={t('toggle_password_visibility', 'Show password')}
                                >
                                    {showNew ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            <label className="affiliate-auth-label">{t('confirm_new_password', 'Confirm new password')}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="affiliate-auth-input"
                                    type={showConf ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                    minLength={6}
                                    disabled={pwdLoading}
                                    style={{ paddingRight: 44 }}
                                />
                                <button
                                    type="button"
                                    className="affiliate-btn affiliate-btn--ghost"
                                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', minWidth: 36 }}
                                    onClick={() => setShowConf(!showConf)}
                                    aria-label={t('toggle_password_visibility', 'Show password')}
                                >
                                    {showConf ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            {pwdError && (
                                <p className="affiliate-muted" style={{ color: 'var(--danger, #c0392b)', margin: '8px 0 0' }}>
                                    {pwdError}
                                </p>
                            )}
                            <button type="submit" className="affiliate-btn affiliate-btn--primary" disabled={pwdLoading} style={{ marginTop: 14 }}>
                                {pwdLoading ? t('affiliate_auth_submitting', 'Please wait…') : t('update_password_btn', 'Update password')}
                            </button>
                        </form>
                    </div>
                )}

                <div className="affiliate-card" style={{ marginTop: 12, borderColor: 'rgba(192, 57, 43, 0.35)' }}>
                    <h2 className="affiliate-h2" style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--danger, #c0392b)' }}>
                        {t('affiliate_delete_section_title', 'Delete account')}
                    </h2>
                    <p className="affiliate-muted" style={{ fontSize: '0.9rem' }}>
                        {t(
                            'affiliate_delete_warning',
                            'This permanently removes your affiliate profile and sign-in. This cannot be undone.'
                        )}
                    </p>
                    {emailPw ? (
                        <form className="affiliate-auth-form" onSubmit={onDeleteAccount}>
                            <label className="affiliate-auth-label">
                                {t('affiliate_delete_type_phrase', 'Type {{word}} to confirm', { word: confirmWord })}
                            </label>
                            <input
                                className="affiliate-auth-input"
                                type="text"
                                value={deletePhrase}
                                onChange={(e) => setDeletePhrase(e.target.value)}
                                autoComplete="off"
                                disabled={deleteLoading}
                            />
                            <label className="affiliate-auth-label">{t('affiliate_delete_password_label', 'Your password')}</label>
                            <input
                                className="affiliate-auth-input"
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                autoComplete="current-password"
                                disabled={deleteLoading}
                            />
                            {deleteError && (
                                <p className="affiliate-muted" style={{ color: 'var(--danger, #c0392b)', margin: '8px 0 0' }}>
                                    {deleteError}
                                </p>
                            )}
                            <button
                                type="submit"
                                className="affiliate-btn"
                                disabled={deleteLoading}
                                style={{
                                    marginTop: 14,
                                    background: 'rgba(192, 57, 43, 0.15)',
                                    color: 'var(--danger, #c0392b)',
                                    border: '1px solid rgba(192, 57, 43, 0.45)',
                                }}
                            >
                                {deleteLoading ? t('affiliate_auth_submitting', 'Please wait…') : t('affiliate_delete_btn', 'Delete my account')}
                            </button>
                        </form>
                    ) : (
                        <p className="affiliate-muted" style={{ fontSize: '0.9rem' }}>
                            {t('affiliate_delete_contact_support', 'Account deletion for this sign-in method is not available here.')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
