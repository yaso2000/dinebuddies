import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { FaStore, FaPhone, FaMapMarkerAlt, FaGlobe, FaEye, FaClock } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import LocationAutocomplete from '../components/LocationAutocomplete';
import LocalhostAppPreviewHint from '../components/LocalhostAppPreviewHint';
import {
    openingHoursToBusinessHours,
    mapGoogleTypesToBusinessType,
    parseGoogleAddressComponents,
} from '../utils/googlePlacesBusiness';
import {
    ENABLE_BACKGROUND_AREA_DETECT,
    GEOLOCATION_OPTIONS,
    detectCityCountryInBackground,
} from '../utils/bigDataCloudGeocode';

const BUSINESS_TYPES = [
    'Restaurant',
    'Cafe',
    'Bar',
    'Night Club',
    'BBQ Parties',
    'Food Truck',
    'Lounge',
    'Other',
];

/**
 * Post-signup business listing setup: auto city detection + Google Maps place search (single field).
 */
export default function BusinessOnboarding() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentUser, loading: authLoading } = useAuth();

    const [pageLoading, setPageLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [areaDetecting, setAreaDetecting] = useState(() => ENABLE_BACKGROUND_AREA_DETECT);
    const [formData, setFormData] = useState({
        businessName: '',
        businessType: 'Restaurant',
        phone: '',
        location: '',
        city: '',
        country: '',
        countryCode: 'AU',
        lat: null,
        lng: null,
        userLat: null,
        userLng: null,
        description: '',
        website: '',
        placeId: null,
        importedHours: null,
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

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
                setFormData((prev) => ({
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
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!currentUser?.uid) {
            navigate('/business/login', { replace: true });
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', currentUser.uid));
                if (cancelled) return;
                if (!snap.exists()) {
                    navigate('/', { replace: true });
                    return;
                }
                const d = snap.data();
                if (d.pendingBusinessRegistration !== true) {
                    navigate(
                        window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard',
                        { replace: true }
                    );
                    return;
                }
                const bi = d.businessInfo || {};
                setFormData((prev) => ({
                    ...prev,
                    businessName: d.display_name || bi.businessName || prev.businessName,
                    businessType: bi.businessType || prev.businessType,
                    phone: bi.phone || prev.phone,
                    location: bi.address || prev.location,
                    city: bi.city || prev.city,
                    country: bi.country || prev.country,
                    countryCode: (bi.country && String(bi.country).length === 2
                        ? String(bi.country).toUpperCase()
                        : prev.countryCode),
                    lat: bi.lat ?? prev.lat,
                    lng: bi.lng ?? prev.lng,
                    description: bi.description || prev.description,
                    website: bi.website || prev.website,
                    placeId: bi.placeId || prev.placeId,
                }));
            } catch {
                if (!cancelled) showToast(t('save_failed', 'Something went wrong'), 'error');
            } finally {
                if (!cancelled) setPageLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [authLoading, currentUser?.uid, navigate, showToast, t]);

    const handleLocationSelect = useCallback((place) => {
        let city = '';
        let country = '';
        let countryCode = '';
        if (Array.isArray(place.addressComponents) && place.addressComponents.length > 0) {
            const parsed = parseGoogleAddressComponents(place.addressComponents);
            city = parsed.city;
            country = parsed.country;
            countryCode = parsed.countryCode;
        }
        if (!city && place.fullAddress) {
            const parts = place.fullAddress.split(',').map((p) => p.trim());
            if (parts.length >= 2) {
                country = parts[parts.length - 1];
                city = parts[parts.length - 2];
            }
        }
        const mappedType = mapGoogleTypesToBusinessType(place.types || []);
        const summaryRaw =
            place.editorialSummary != null && place.editorialSummary !== ''
                ? String(place.editorialSummary).trim()
                : '';
        const summary = summaryRaw ? summaryRaw.slice(0, 300) : null;

        const nameFromPlace = (place.name && String(place.name).trim()) || '';
        const phoneFromPlace = (place.phone && String(place.phone).trim()) || '';
        const websiteFromPlace = (place.website && String(place.website).trim()) || '';

        setFormData((prev) => ({
            ...prev,
            location:
                (place.fullAddress && String(place.fullAddress).trim()) ||
                place.name ||
                prev.location,
            lat: place.lat != null ? place.lat : prev.lat,
            lng: place.lng != null ? place.lng : prev.lng,
            city: city || prev.city,
            country: country || prev.country,
            countryCode: countryCode || prev.countryCode,
            phone: phoneFromPlace || prev.phone,
            businessName: nameFromPlace || prev.businessName,
            businessType: mappedType || prev.businessType,
            description: summary != null ? summary : prev.description,
            website: websiteFromPlace || prev.website,
            placeId: place.placeId || prev.placeId,
            importedHours:
                place.openingHours != null ? place.openingHours : prev.importedHours,
        }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser?.uid) return;
        if (!formData.businessName?.trim() || !formData.phone?.trim() || !formData.location?.trim()) {
            showToast(
                t('business_onboarding_required', 'Please add business name, phone, and location.'),
                'error'
            );
            return;
        }
        if (!formData.city?.trim()) {
            showToast(
                t('business_onboarding_city', 'City is still missing — wait for location detection or pick a fuller address.'),
                'error'
            );
            return;
        }

        setSaving(true);
        try {
            const hoursModel = formData.importedHours
                ? openingHoursToBusinessHours(formData.importedHours)
                : null;
            const updates = {
                display_name: formData.businessName.trim(),
                pendingBusinessRegistration: false,
                last_active_time: serverTimestamp(),
                'businessInfo.businessName': formData.businessName.trim(),
                'businessInfo.businessType': formData.businessType,
                'businessInfo.phone': formData.phone.trim(),
                'businessInfo.city': formData.city.trim(),
                'businessInfo.country': formData.country || formData.countryCode,
                'businessInfo.address': formData.location.trim(),
                'businessInfo.lat': formData.lat ?? null,
                'businessInfo.lng': formData.lng ?? null,
                'businessInfo.description': (formData.description || '').trim().slice(0, 300),
                'businessInfo.website': (formData.website || '').trim(),
            };
            if (formData.placeId) updates['businessInfo.placeId'] = formData.placeId;
            if (hoursModel) updates['businessInfo.hours'] = hoursModel;

            await updateDoc(doc(db, 'users', currentUser.uid), updates);
            showToast(t('business_onboarding_saved', 'Your business listing is ready.'), 'success');
            navigate(`/business/${currentUser.uid}`, { replace: true });
        } catch (err) {
            console.error(err);
            showToast(err?.message || t('save_failed', 'Save failed'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || pageLoading) {
        return (
            <div
                style={{
                    minHeight: '100dvh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-body)',
                }}
            >
                <div
                    className="loader-ring"
                    style={{ width: 44, height: 44, border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }}
                />
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100dvh',
                background: 'var(--bg-body)',
                padding: 'max(12px, env(safe-area-inset-top)) 1rem max(28px, env(safe-area-inset-bottom))',
            }}
        >
            <div
                style={{
                    maxWidth: 520,
                    margin: '0 auto',
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                }}
            >
                <div
                    style={{
                        padding: '1.35rem 1.5rem',
                        borderBottom: '1px solid var(--border-color)',
                    }}
                >
                    <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)' }}>
                        {t('business_onboarding_title', 'Complete your business listing')}
                    </h1>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {t(
                            'business_onboarding_sub',
                            'We detect your area first, then you search for your business on Google Maps. Picking a listing fills name, description (when available), phone, website, and opening hours — edit anything before saving.'
                        )}
                    </p>
                    <div style={{ marginTop: '1rem' }}>
                        <LocalhostAppPreviewHint />
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                    <div
                        style={{
                            background: 'var(--bg-body)',
                            padding: '1.15rem',
                            borderRadius: 16,
                            border: '1px solid var(--border-color)',
                            marginBottom: '1.35rem',
                        }}
                    >
                        <label style={{ ...labelStyle, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                            {t('business_onboarding_detected_city_label', 'Detected city / area (automatic)')}
                        </label>
                        <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            aria-readonly="true"
                            value={
                                areaDetecting && !formData.city && !formData.country
                                    ? ''
                                    : [formData.city, formData.country].filter(Boolean).join(', ') ||
                                      t(
                                          'business_onboarding_area_unknown',
                                          'Could not detect city — search still works; pick your business below.'
                                      )
                            }
                            placeholder={
                                areaDetecting && !formData.city && !formData.country
                                    ? t('business_onboarding_area_detecting', 'Detecting approximate city…')
                                    : ''
                            }
                            style={{
                                ...inputStyle,
                                cursor: 'default',
                                opacity: areaDetecting && !formData.city && !formData.country ? 0.85 : 1,
                                borderColor: 'rgba(139, 92, 246, 0.35)',
                                background: 'rgba(139, 92, 246, 0.06)',
                            }}
                        />
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.45rem 0 0', lineHeight: 1.45 }}>
                            {t('business_onboarding_area_hint')}
                        </p>

                        <div
                            className="venue-search-stack"
                            style={{
                                marginTop: '1.1rem',
                                paddingTop: '1.1rem',
                                borderTop: '1px solid var(--border-color)',
                            }}
                        >
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-main)' }}>
                                {t('business_onboarding_location_section', 'Find your business on Google Maps')}
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.65rem', lineHeight: 1.45 }}>
                                {t(
                                    'business_onboarding_address_autocomplete_hint',
                                    'Search by business name or address. Choosing a Google listing fills the fields below when Google provides them.'
                                )}
                            </p>
                            <label style={{ ...labelStyle, fontSize: '0.82rem' }}>
                                {t('form_location_placeholder', 'Search address or venue')}
                                {' *'}
                            </label>
                            <LocationAutocomplete
                                value={formData.location}
                                onChange={handleChange}
                                onSelect={handleLocationSelect}
                                city={formData.city}
                                countryCode={formData.countryCode}
                                userLat={formData.userLat}
                                userLng={formData.userLng}
                                useGooglePlacesMinimal
                            />
                        </div>
                    </div>

                    <h3
                        style={{
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            margin: '0 0 0.85rem',
                            color: 'var(--text-main)',
                        }}
                    >
                        {t('business_onboarding_details_section', 'Business details')}
                    </h3>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>
                            <FaStore style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                            {t('business_name_label', 'Business name')}
                            {' *'}
                        </label>
                        <input
                            type="text"
                            name="businessName"
                            value={formData.businessName}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>{t('business_type_label', 'Business type')}</label>
                        <select name="businessType" value={formData.businessType} onChange={handleChange} style={inputStyle}>
                            {BUSINESS_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>
                            <FaPhone style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                            {t('phone', 'Phone')}
                            {' *'}
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>{t('website', 'Website')} ({t('optional', 'optional')})</label>
                        <input
                            type="url"
                            name="website"
                            value={formData.website}
                            onChange={handleChange}
                            placeholder="https://"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>{t('description', 'Description')} ({t('optional', 'optional')})</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            maxLength={300}
                            style={{ ...inputStyle, resize: 'vertical' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            {(formData.description || '').length}/300
                        </div>
                    </div>

                    {Array.isArray(formData.importedHours?.weekday_text) && formData.importedHours.weekday_text.length > 0 ? (
                        <div
                            style={{
                                marginBottom: '1.25rem',
                                padding: '1rem',
                                borderRadius: 16,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-body)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
                                <FaClock style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                    {t('business_onboarding_hours_imported', 'Opening hours (from Google)')}
                                </h3>
                            </div>
                            <p style={{ margin: '0 0 0.65rem', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                                {t(
                                    'business_onboarding_hours_imported_hint',
                                    'Saved with your listing. You can adjust hours later on your profile if needed.'
                                )}
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {formData.importedHours.weekday_text.map((line) => (
                                    <li key={line} style={{ marginBottom: 4 }}>
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <div
                        style={{
                            marginBottom: '1.25rem',
                            padding: '1rem',
                            borderRadius: 16,
                            border: '1px dashed rgba(139, 92, 246, 0.45)',
                            background: 'rgba(139, 92, 246, 0.06)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: '0.5rem',
                            }}
                        >
                            <FaEye style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: '0.92rem',
                                    fontWeight: 800,
                                    color: 'var(--text-main)',
                                }}
                            >
                                {t('business_onboarding_preview_title', 'Listing preview')}
                            </h3>
                        </div>
                        <p
                            style={{
                                margin: '0 0 0.9rem',
                                fontSize: '0.76rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.45,
                            }}
                        >
                            {t(
                                'business_onboarding_preview_hint',
                                'Approximate look in listings. You can add photos and more details on your profile after saving.'
                            )}
                        </p>
                        <div
                            style={{
                                borderRadius: 20,
                                overflow: 'hidden',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-card)',
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                        >
                            <div
                                style={{
                                    height: 132,
                                    background:
                                        'linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(234, 88, 12, 0.25), rgba(59, 130, 246, 0.2))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.55)',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                }}
                            >
                                {t('business_onboarding_preview_cover_placeholder', 'Cover photo — add after setup')}
                            </div>
                            <div style={{ padding: '1rem 1.1rem 1.15rem' }}>
                                <span
                                    style={{
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        color: 'var(--primary)',
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        border: '1px solid rgba(139, 92, 246, 0.35)',
                                        borderRadius: 10,
                                        marginBottom: 8,
                                    }}
                                >
                                    {formData.businessType || '—'}
                                </span>
                                <h4
                                    style={{
                                        margin: '0 0 10px',
                                        fontSize: '1.15rem',
                                        fontWeight: 800,
                                        color: formData.businessName?.trim()
                                            ? 'var(--text-main)'
                                            : 'var(--text-muted)',
                                        lineHeight: 1.25,
                                    }}
                                >
                                    {formData.businessName?.trim()
                                        ? formData.businessName.trim()
                                        : t('business_onboarding_preview_name_placeholder', 'Business name')}
                                </h4>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 8,
                                        fontSize: '0.85rem',
                                        color: 'var(--text-muted)',
                                        marginBottom: 8,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    <FaMapMarkerAlt
                                        style={{ marginTop: 3, flexShrink: 0, opacity: 0.85 }}
                                    />
                                    <span>
                                        {formData.location?.trim()
                                            ? formData.location.trim()
                                            : t('business_onboarding_preview_location_placeholder', 'Address')}
                                    </span>
                                </div>
                                {(formData.phone || '').trim() ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontSize: '0.85rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: 6,
                                        }}
                                    >
                                        <FaPhone style={{ flexShrink: 0, opacity: 0.85 }} />
                                        <span>{formData.phone.trim()}</span>
                                    </div>
                                ) : null}
                                {(formData.website || '').trim() ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontSize: '0.82rem',
                                            color: 'var(--primary)',
                                            marginBottom: 6,
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        <FaGlobe style={{ flexShrink: 0, opacity: 0.85 }} />
                                        <span>{formData.website.trim()}</span>
                                    </div>
                                ) : null}
                                {(formData.description || '').trim() ? (
                                    <p
                                        style={{
                                            margin: '10px 0 0',
                                            fontSize: '0.82rem',
                                            lineHeight: 1.45,
                                            color: 'var(--text-muted)',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {formData.description.trim()}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: 14,
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            cursor: saving ? 'wait' : 'pointer',
                            color: '#fff',
                            background: 'linear-gradient(135deg, var(--primary, #8b5cf6), #ea580c)',
                            opacity: saving ? 0.75 : 1,
                        }}
                    >
                        {saving
                            ? t('save_pending', 'Saving…')
                            : t('business_onboarding_submit', 'Save and open my profile')}
                    </button>
                </form>
            </div>
        </div>
    );
}

const labelStyle = {
    display: 'block',
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    marginBottom: '0.45rem',
};

const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--bg-body)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    color: 'var(--text-main)',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
};
