import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStore, FaEnvelope, FaLock, FaPhone, FaMapMarkerAlt, FaArrowRight, FaArrowLeft, FaCheck, FaGoogle } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from 'react-i18next';
import LocationAutocomplete from '../components/LocationAutocomplete';
import CityAutocomplete from '../components/CityAutocomplete';
import GoogleBusinessImporter from '../components/GoogleBusinessImporter';
import { Country } from 'country-state-city';
import { fetchIpLocation } from '../utils/locationUtils';

const BusinessSignup = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Account, 2: Business Info, 3: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [locationStatus, setLocationStatus] = useState('detecting'); // 'detecting' | 'detected' | 'failed'
    const [entryMode, setEntryMode] = useState(null); // null = choose | 'manual' | 'google'
    const [showCityOverride, setShowCityOverride] = useState(false);
    const [importedFromGoogle, setImportedFromGoogle] = useState(null); // { coverImage, gallery, website, placeId, description, workingHours }
    const [importedGallery, setImportedGallery] = useState([]); // editable list of gallery URLs after import
    const [lastImportRejectedData, setLastImportRejectedData] = useState(null); // when city mismatch, so importer can offer "Use anyway"

    // Form data
    const [formData, setFormData] = useState({
        // Account Info
        email: '',
        password: '',
        confirmPassword: '',

        // Business Info
        businessName: '',
        businessType: 'Restaurant',
        phone: '',
        description: '',
        city: '', // سيتم تعبئتها تلقائياً من GPS
        country: 'AU',
        location: '', // العنوان من LocationAutocomplete
        userLat: null, // GPS coordinates
        userLng: null,
        lat: null, // Selected location coordinates
        lng: null
    });

    const businessTypes = [
        'Restaurant', 'Cafe', 'Bar', 'Night Club', 'Food Truck', 'Fast Food'
    ];

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    // Determine city from user's actual location only (GPS, then IP fallback). Required for business signup.
    useEffect(() => {
        let cancelled = false;

        const setCityFromCoords = async (lat, lng) => {
            try {
                // Prefer Nominatim first (better locality for towns like Bundaberg), then BigDataCloud
                const { reverseGeocode } = await import('../utils/locationUtils');
                const reversed = await reverseGeocode(lat, lng);
                if (!cancelled && reversed.success && reversed.city) {
                    const countryCode = (reversed.raw?.country_code || formData.country || 'AU').toString().toUpperCase().slice(0, 2);
                    setFormData(prev => ({ ...prev, city: reversed.city.trim(), country: countryCode, userLat: lat, userLng: lng }));
                    setLocationStatus('detected');
                    return;
                }
            } catch (e) {
                /* fall through to BigDataCloud */
            }
            try {
                const res = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
                );
                if (!res.ok || cancelled) return;
                const data = await res.json();
                // Use only city or locality — never principalSubdivision (e.g. "Queensland") as city
                const city = (data.city || data.locality || '').trim();
                const countryCode = (data.countryCode || 'AU').toUpperCase();
                if (city && !cancelled) {
                    setFormData(prev => ({ ...prev, city, country: countryCode, userLat: lat, userLng: lng }));
                    setLocationStatus('detected');
                }
            } catch (e) {
                if (!cancelled) setLocationStatus('failed');
            }
        };

        const tryIpFallback = async () => {
            const result = await fetchIpLocation();
            if (cancelled) return;
            if (result.success && result.city) {
                const countryCode = (result.country_code || 'AU').toString().toUpperCase().slice(0, 2);
                setFormData(prev => ({
                    ...prev,
                    city: result.city,
                    country: countryCode,
                    ...(result.latitude != null && result.longitude != null
                        ? { userLat: result.latitude, userLng: result.longitude }
                        : {})
                }));
                setLocationStatus('detected');
            } else {
                setLocationStatus('failed');
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (cancelled) return;
                    const { latitude, longitude } = position.coords;
                    setCityFromCoords(latitude, longitude);
                },
                () => {
                    if (cancelled) return;
                    tryIpFallback();
                },
                { timeout: 12000, maximumAge: 300000, enableHighAccuracy: false }
            );
        } else {
            tryIpFallback();
        }

        return () => { cancelled = true; };
    }, []);

    // Business address: only set location/lat/lng. City stays from user location. Validate address is in same city.
    const handleLocationSelect = async (placeData) => {
        const lat = placeData.lat;
        const lng = placeData.lng;
        const locationName = placeData.name || placeData.fullAddress;

        if (lat != null && lng != null && formData.city) {
            try {
                const res = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
                );
                if (res.ok) {
                    const data = await res.json();
                    const addressCity = (data.city || data.locality || data.principalSubdivision || '').trim().toLowerCase();
                    const userCity = (formData.city || '').trim().toLowerCase();
                    if (addressCity && userCity && addressCity !== userCity) {
                        setError(t('business_address_same_city', { city: formData.city }) || `Business address must be in ${formData.city}. You are registering from this city only.`);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Reverse geocode for address failed:', e.message);
            }
        }

        setError('');
        setFormData(prev => ({ ...prev, location: locationName, lat, lng }));
    };

    const handleGoogleImport = (data, options = {}) => {
        const useAnyway = options.useAnyway === true;
        const userCity = (formData.city || '').trim().toLowerCase();
        const businessCity = (data.city || '').trim().toLowerCase();
        const cityMismatch = userCity && businessCity && userCity !== businessCity;

        if (cityMismatch && !useAnyway) {
            const msg = t('business_address_same_city', { city: formData.city, businessCity: data.city });
            const fallback = `This business is in ${data.city}. You can only register businesses in ${formData.city} (your detected city). Use it anyway to register in ${data.city}.`;
            setError(typeof msg === 'string' && msg !== 'business_address_same_city' ? msg : fallback);
            setLastImportRejectedData(data);
            return;
        }
        setError('');
        setLastImportRejectedData(null);
        setFormData(prev => ({
            ...prev,
            businessName: data.businessName || prev.businessName,
            businessType: prev.businessType,
            phone: data.phone || prev.phone,
            description: data.description || prev.description,
            location: data.address || prev.location,
            lat: data.lat ?? prev.lat,
            lng: data.lng ?? prev.lng,
            ...(useAnyway || cityMismatch ? { city: data.city || prev.city, country: data.countryCode || prev.country } : {}),
        }));
        setImportedFromGoogle({
            coverImage: data.coverImage || null,
            gallery: Array.isArray(data.gallery) ? data.gallery : [],
            website: data.website || null,
            placeId: data.placeId || null,
            workingHours: data.workingHours || null,
            description: data.description || null,
        });
        setImportedGallery(Array.isArray(data.gallery) ? [...data.gallery] : []);
        setEntryMode('manual');
    };

    const handleRetryLocation = async () => {
        setLocationStatus('detecting');
        setError('');
        const result = await fetchIpLocation();
        if (result.success && result.city) {
            const countryCode = (result.country_code || 'AU').toString().toUpperCase().slice(0, 2);
            setFormData(prev => ({
                ...prev,
                city: result.city,
                country: countryCode,
                ...(result.latitude != null && result.longitude != null
                    ? { userLat: result.latitude, userLng: result.longitude }
                    : {})
            }));
            setLocationStatus('detected');
        } else {
            setLocationStatus('failed');
        }
    };

    const validateEmailFormat = (email) => {
        const trimmed = (email || '').trim();
        if (!trimmed) return false;
        // Basic structure: something@domain.tld (at least one char before @, domain with TLD)
        const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
        return re.test(trimmed);
    };

    const validateStep1 = () => {
        if (!formData.email || !formData.password || !formData.confirmPassword) {
            setError('Please fill in all fields');
            return false;
        }
        if (!validateEmailFormat(formData.email)) {
            setError('Please enter a valid email address (e.g. name@example.com)');
            return false;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!formData.businessName || !formData.phone) {
            setError('Please fill in all required fields');
            return false;
        }
        if (!formData.city) {
            setError('Please wait for location detection or enable location services');
            return false;
        }
        if (locationStatus === 'failed') {
            setError(t('location_detection_failed') || 'We could not detect your city. Please enable location access or try again.');
            return false;
        }
        if (!formData.location) {
            setError('Please search and select your business address');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
            setError('');
        } else if (step === 2 && validateStep2()) {
            handleSubmit();
        }
    };

    const handleBack = () => {
        setStep(step - 1);
        setError('');
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            // Create Firebase Auth account
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                formData.email,
                formData.password
            );

            const user = userCredential.user;

            const bizInfo = {
                businessType: formData.businessType,
                phone: formData.phone,
                city: formData.city,
                country: formData.country,
                description: formData.description || importedFromGoogle?.description || '',
                address: formData.location,
                coverImage: importedFromGoogle?.coverImage ?? null,
                lat: formData.lat,
                lng: formData.lng,
                placeId: importedFromGoogle?.placeId ?? null,
                isPublished: false,
                createdAt: serverTimestamp(),
            };
            if (importedFromGoogle?.website) bizInfo.website = importedFromGoogle.website;
            const galleryUrls = importedGallery?.length ? importedGallery : importedFromGoogle?.gallery || [];
            if (galleryUrls.length) {
                bizInfo.gallery = galleryUrls;
                bizInfo.galleryEnhanced = galleryUrls.map(url => ({
                    url,
                    category: 'venue',
                    caption: '',
                    addedAt: new Date().toISOString(),
                }));
            }
            if (importedFromGoogle?.workingHours) bizInfo.workingHours = importedFromGoogle.workingHours;

            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: formData.email,
                role: 'business',
                display_name: formData.businessName,
                photo_url: importedFromGoogle?.coverImage ?? null,
                created_at: serverTimestamp(),
                last_active_time: serverTimestamp(),
                businessInfo: bizInfo,
                followersCount: 0,
                ownedCommunities: []
            });

            // Send Verification Email
            await sendEmailVerification(user);

            // Success!
            setStep(3);
        } catch (error) {
            console.error('Error creating business account:', error);
            if (error.code === 'auth/email-already-in-use') {
                setError('This email is already registered');
            } else if (error.code === 'auth/invalid-email') {
                setError('Invalid email address');
            } else {
                setError('Failed to create account. Please try again.');
            }
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100dvh',
            background: 'var(--bg-body)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '2rem 1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid var(--border-color)',
                margin: 'auto',
                flexShrink: 0,
                boxShadow: 'var(--shadow-premium)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        background: 'var(--primary)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.8rem',
                        fontSize: '1.6rem',
                        boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)'
                    }}>
                        <HiBuildingStorefront style={{ color: '#fff' }} />
                    </div>
                    <h1 style={{
                        fontSize: '1.3rem',
                        fontWeight: '800',
                        marginBottom: '0.3rem',
                        color: 'var(--text-main)'
                    }}>
                        Create Business Account
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Join DineBuddies as a partner
                    </p>
                </div>

                {/* Progress Steps */}
                {step !== 3 && (
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '1.5rem',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '30%',
                            height: '4px',
                            background: step >= 1 ? 'var(--primary)' : 'var(--bg-input)',
                            borderRadius: '4px',
                            transition: 'all 0.3s'
                        }} />
                        <div style={{
                            width: '30%',
                            height: '4px',
                            background: step >= 2 ? 'var(--primary)' : 'var(--bg-input)',
                            borderRadius: '4px',
                            transition: 'all 0.3s'
                        }} />
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: 'rgba(255, 68, 68, 0.1)',
                        border: '1px solid rgba(255, 68, 68, 0.3)',
                        borderRadius: '10px',
                        padding: '0.8rem',
                        marginBottom: '1rem',
                        color: '#ff6b6b',
                        fontSize: '0.85rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {/* Step 1: Account Info */}
                {step === 1 && (
                    <div>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            marginBottom: '1rem',
                            color: 'var(--text-main)',
                            textAlign: 'center'
                        }}>
                            Account Information
                        </h3>

                        <div style={{ marginBottom: '0.8rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Business Email"
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.8rem',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-main)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '0.8rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Password"
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.8rem',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-main)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }} />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm Password"
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.8rem',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-main)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleNext}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                                border: 'none',
                                borderRadius: '10px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)'
                            }}
                        >
                            Next Step
                            <FaArrowRight />
                        </button>
                    </div>
                )}

                {/* Step 2: Business Info */}
                {step === 2 && (
                    <div>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            marginBottom: '1rem',
                            color: 'var(--text-main)',
                            textAlign: 'center'
                        }}>
                            Business Information
                        </h3>

                        {/* Step 2a: Choose how to add business — two clear options */}
                        {entryMode === null && (
                            <>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.25rem' }}>
                                    {t('business_info_how', 'How do you want to add your business?')}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setEntryMode('manual')}
                                        style={{
                                            width: '100%',
                                            padding: '1rem 1.25rem',
                                            background: 'var(--bg-input)',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: '12px',
                                            color: 'var(--text-main)',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <FaStore style={{ fontSize: '1.25rem', flexShrink: 0 }} />
                                        <span>{t('enter_manually', 'Enter my business details manually')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEntryMode('google')}
                                        style={{
                                            width: '100%',
                                            padding: '1rem 1.25rem',
                                            background: 'rgba(66, 133, 244, 0.08)',
                                            border: '2px solid rgba(66, 133, 244, 0.4)',
                                            borderRadius: '12px',
                                            color: 'var(--text-main)',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <FaGoogle style={{ color: '#4285F4', fontSize: '1.25rem', flexShrink: 0 }} />
                                        <span>{t('import_from_google', 'Import from Google Business')}</span>
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem' }}>
                                    <button onClick={handleBack} style={{ flex: 1, padding: '0.8rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <FaArrowLeft /> Back
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Step 2b: Only Google import — no form */}
                        {entryMode === 'google' && (
                            <GoogleBusinessImporter
                                onImport={handleGoogleImport}
                                onUseAnyway={lastImportRejectedData ? () => handleGoogleImport(lastImportRejectedData, { useAnyway: true }) : undefined}
                                importError={error}
                                onCancel={() => { setEntryMode(null); setError(''); setLastImportRejectedData(null); }}
                                city={formData.city}
                                countryCode={formData.country}
                                userLat={formData.userLat}
                                userLng={formData.userLng}
                            />
                        )}

                        {/* Step 2c: Only manual form (or prefilled after import) */}
                        {entryMode === 'manual' && (
                            <>
                                {importedFromGoogle && (
                                    <div style={{
                                        marginBottom: '1rem',
                                        padding: '0.6rem 0.8rem',
                                        background: 'rgba(66, 133, 244, 0.1)',
                                        border: '1px solid rgba(66, 133, 244, 0.3)',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                    }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FaGoogle style={{ color: '#4285F4' }} />
                                            {t('imported_from_google', 'Imported from Google. You can edit below.')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setImportedFromGoogle(null); setImportedGallery([]); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            {t('enter_manually_instead', 'Enter manually instead')}
                                        </button>
                                    </div>
                                )}

                        <div style={{ marginBottom: '0.8rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaStore style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }} />
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    placeholder="Business Name"
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.8rem',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-main)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '0.8rem' }}>
                            <select
                                name="businessType"
                                value={formData.businessType}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 1rem',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    appearance: 'none'
                                }}
                            >
                                {businessTypes.map(type => (
                                    <option key={type} value={type} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '0.8rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaPhone style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }} />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="Phone Number"
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.8rem',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-main)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Description (optional) */}
                        <div style={{ marginBottom: '0.8rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                                {t('about_business', 'About / Description')} <span style={{ fontWeight: 'normal' }}>({t('optional', 'optional')})</span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder={t('description_placeholder', 'Short description of your business')}
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 1rem',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        {/* Gallery (from Google) — editable after import */}
                        {importedGallery.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                                    {t('gallery', 'Gallery')} ({t('from_google', 'from Google')}) — {t('edit_before_continue', 'remove any you don\'t want')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
                                    {importedGallery.map((url, index) => (
                                        <div key={`${url}-${index}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-input)' }}>
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            <button
                                                type="button"
                                                onClick={() => setImportedGallery(prev => prev.filter((_, i) => i !== index))}
                                                style={{
                                                    position: 'absolute',
                                                    top: 4,
                                                    right: 4,
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: '50%',
                                                    background: 'rgba(0,0,0,0.7)',
                                                    border: 'none',
                                                    color: '#fff',
                                                    fontSize: '0.9rem',
                                                    lineHeight: 1,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: 0,
                                                }}
                                                title={t('remove', 'Remove')}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* City: from user location only (hidden in background). Read-only unless user corrects. */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                {t('city_auto_detected', 'City (detected from your location — you can only register in this city)')}
                            </div>
                            {locationStatus === 'detected' && formData.city ? (
                                showCityOverride ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <CityAutocomplete
                                            value={formData.city}
                                            onSelect={({ city, countryCode }) => {
                                                setFormData(prev => ({ ...prev, city, country: countryCode || prev.country }));
                                                setShowCityOverride(false);
                                            }}
                                            countryCode={formData.country}
                                            placeholder={t('search_city_google', 'Search city on Google Maps...')}
                                        />
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {t('city_from_google_only', 'Only cities that exist on Google Maps can be selected.')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowCityOverride(false)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                background: 'transparent',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 8,
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                alignSelf: 'flex-start',
                                            }}
                                        >
                                            {t('cancel', 'Cancel')}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '0.6rem 0.8rem',
                                        background: 'var(--bg-input)',
                                        borderRadius: '10px',
                                        border: '1px solid var(--primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        fontSize: '0.9rem',
                                        color: 'var(--text-main)',
                                        flexWrap: 'wrap',
                                    }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span>📍</span>
                                            <span>{formData.city}, {Country.getCountryByCode(formData.country)?.name}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowCityOverride(true)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--primary)',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                            }}
                                        >
                                            {t('wrong_city_change', 'Wrong city? Change')}
                                        </button>
                                    </div>
                                )
                            ) : locationStatus === 'failed' ? (
                                <div style={{
                                    padding: '0.8rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '10px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-main)'
                                }}>
                                    <p style={{ margin: '0 0 8px' }}>{t('location_detection_failed') || 'We could not detect your city. Please enable location access or try again.'}</p>
                                    <button
                                        type="button"
                                        onClick={handleRetryLocation}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: 'var(--primary)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'white',
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('retry') || 'Retry'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    padding: '0.6rem 0.8rem',
                                    background: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    <span>⏳</span>
                                    <span>{t('detecting_location', 'Detecting your location...')}</span>
                                </div>
                            )}
                        </div>

                        {/* Business Address Search */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <LocationAutocomplete
                                value={formData.location}
                                onChange={handleChange}
                                onSelect={handleLocationSelect}
                                city={formData.city}
                                countryCode={formData.country}
                                userLat={formData.userLat}
                                userLng={formData.userLng}
                                placeholder="Search Business Address"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button
                                onClick={handleBack}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    color: 'var(--text-main)',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <FaArrowLeft />
                                Back
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={loading}
                                style={{
                                    flex: 2,
                                    padding: '0.8rem',
                                    background: loading ? 'var(--bg-input)' : 'linear-gradient(135deg, #a78bfa, #ec4899)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    opacity: loading ? 0.6 : 1,
                                    boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)'
                                }}
                            >
                                {loading ? 'Creating...' : 'Create Account'}
                                {!loading && <FaCheck />}
                            </button>
                        </div>
                            </>
                        )}
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            fontSize: '2.5rem',
                            border: '2px solid #10b981'
                        }} >
                            <FaCheck style={{ color: '#10b981' }} />
                        </div>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            marginBottom: '0.8rem',
                            color: 'var(--text-main)'
                        }}>
                            Account Created!
                        </h2>
                        <p style={{
                            color: 'var(--text-secondary)',
                            marginBottom: '2rem',
                            lineHeight: '1.5',
                            fontSize: '0.9rem'
                        }}>
                            Your business account is ready.
                        </p>
                        <button
                            onClick={() => navigate(`/business/${currentUser?.uid}`)}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                                border: 'none',
                                borderRadius: '10px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                marginBottom: '0.8rem'
                            }}
                        >
                            Complete Profile
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Dashboard
                        </button>
                    </div>
                )}

                {/* Footer */}
                {step !== 3 && (
                    <div style={{
                        marginTop: '1.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)',
                        textAlign: 'center'
                    }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Already have an account?{' '}
                            <span
                                onClick={() => navigate('/login')}
                                style={{
                                    color: '#a78bfa',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Sign in
                            </span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessSignup;
