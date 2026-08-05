import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { isAffiliateAgent } from '../../utils/accountRole';
import AppRouteLoading from '../../components/AppRouteLoading';
import { useToast } from '../../context/ToastContext';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import { parseGoogleAddressComponents } from '../../utils/googlePlacesBusiness';
import { FaSignOutAlt } from 'react-icons/fa';
import './AffiliateDashboard.css';
import '../../components/venue-search.css';
import { AppText, AppTextInput } from "../../components/base";

function validatePaypalEmail(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t.slice(0, 120);
}

export default function AffiliateSettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser, userProfile, loading, profileServerSynced, signOut } = useAuth();

  const [phone, setPhone] = useState('');
  const [paypal, setPaypal] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const mapsInputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-main)',
    fontSize: '0.95rem'
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
  }, [userProfile]);

  if (loading) {
    return <AppRouteLoading variant="session" fullViewport />;
  }

  if (!currentUser) {
    return <Navigate to="/affiliate/login?next=/affiliate/settings" replace />;
  }

  if (!profileServerSynced) {
    return <AppRouteLoading variant="session" fullViewport />;
  }

  if (!userProfile || !isAffiliateAgent(userProfile)) {
    return <Navigate to="/affiliate/login?next=/affiliate/settings" replace />;
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

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        affiliate_phone: p,
        affiliate_paypal_email: pay,
        affiliate_address: addr,
        affiliate_country: co,
        affiliate_city: ci
      });
      showToast(t('affiliate_settings_saved', 'Settings saved.'), 'success');
    } catch (err) {
      console.warn('[AffiliateSettings]', err?.code, err?.message);
      showToast(err?.message || t('affiliate_settings_save_failed', 'Could not save settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="affiliate-shell">
            <div className="affiliate-dash" style={{ maxWidth: 560 }}>
                <header className="affiliate-header">
                    <div>
                        <AppText as="h1">{t('affiliate_settings_title', 'Affiliate settings')}</AppText>
                        <AppText as="p" className="affiliate-sub">
                            {t('affiliate_settings_sub', 'Update your payout contact details. Balances are managed by the system.')}
                        </AppText>
                    </div>
                    <div className="affiliate-header-actions">
                        <Link to="/affiliate/dashboard" className="affiliate-btn affiliate-btn--secondary">
                            {t('affiliate_settings_back_dashboard', 'Back to dashboard')}
                        </Link>
                        <button
              type="button"
              className="affiliate-btn affiliate-btn--ghost"
              onClick={() => signOut('/login')}>
              
                            <FaSignOutAlt aria-hidden />
                            {t('logout', 'Log out')}
                        </button>
                    </div>
                </header>

                <div className="affiliate-card" style={{ marginTop: 8 }}>
                    <form className="affiliate-auth-form" onSubmit={onSave}>
                        <label className="affiliate-auth-label">{t('affiliate_auth_phone', 'Phone number')}</label>
                        <input
              className="affiliate-auth-input"
              type="tel"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              autoComplete="tel"
              required />
            

                        <div className="venue-search-stack" style={{ marginTop: 4 }}>
                            <label className="affiliate-auth-label">
                                {t('affiliate_signup_maps_label', 'City & country (Google Maps)')}
                            </label>
                            <AppText as="p" className="affiliate-muted" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
                                {t(
                  'affiliate_settings_maps_hint',
                  'Pick a place to update city and country, or keep the values shown below.'
                )}
                            </AppText>
                            <LocationAutocomplete
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                onSelect={handlePlaceSelect}
                city={city}
                countryCode={countryCode}
                useGooglePlacesMinimal
                inputStyle={mapsInputStyle}
                placeholder={t('affiliate_signup_maps_placeholder', 'e.g. Dubai, London, Sydney…')}
                aria-label={t('affiliate_signup_maps_label', 'City & country (Google Maps)')} />
              
                            {(country || city) &&
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                  justifyContent: 'space-between'
                }}>
                
                                    <AppText as="span" className="affiliate-muted" style={{ fontSize: '0.9rem' }}>
                                        <strong>{t('affiliate_signup_maps_selected', 'Selected')}:</strong>{' '}
                                        {[city, country].filter(Boolean).join(', ') || '—'}
                                    </AppText>
                                    <button type="button" className="affiliate-btn affiliate-btn--ghost" onClick={clearLocation}>
                                        {t('affiliate_signup_maps_clear', 'Clear')}
                                    </button>
                                </div>
              }
                        </div>

                        <label className="affiliate-auth-label">{t('affiliate_auth_paypal', 'PayPal email')}</label>
                        <AppTextInput
              className="affiliate-auth-input"
              type="email"
              value={paypal}
              onChange={(ev) => setPaypal(ev.target.value)}
              autoComplete="email"
              required />
            

                        <label className="affiliate-auth-label">{t('affiliate_settings_address', 'Mailing address')}</label>
                        <AppTextInput as="textarea"
            className="affiliate-auth-input"
            rows={4}
            value={address}
            onChange={(ev) => setAddress(ev.target.value)}
            style={{ resize: 'vertical', minHeight: 100 }}
            required />
            

                        <button type="submit" className="affiliate-btn affiliate-btn--primary" disabled={saving} style={{ marginTop: 16 }}>
                            {saving ? t('affiliate_auth_submitting', 'Please wait…') : t('affiliate_settings_save', 'Save changes')}
                        </button>
                    </form>
                </div>
            </div>
        </div>);

}