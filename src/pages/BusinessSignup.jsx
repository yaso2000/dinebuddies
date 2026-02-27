import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStore, FaEnvelope, FaLock, FaPhone, FaMapMarkerAlt, FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from 'react-i18next';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { Country } from 'country-state-city';

const BusinessSignup = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Account, 2: Business Info, 3: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
        city: '', // سيتم تعبئتها تلقائياً من GPS
        country: 'AU',
        location: '', // العنوان من LocationAutocomplete
        userLat: null, // GPS coordinates
        userLng: null,
        lat: null, // Selected location coordinates
        lng: null
    });

    const businessTypes = [
        'Restaurant', 'Cafe', 'Bar', 'Night Club',
        'BBQ Parties', 'Food Truck', 'Lounge', 'Other'
    ];

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    // Auto-detect user location (same as CreateInvitation)
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;

                // Set coordinates immediately
                setFormData(prev => ({
                    ...prev,
                    userLat: latitude,
                    userLng: longitude
                }));

                try {
                    // Use BigDataCloud API - Free and CORS friendly
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );

                    if (!response.ok) throw new Error('Geocoding failed');

                    const data = await response.json();

                    if (data) {
                        // Priority order for city/locality
                        const detectedCity = data.city || data.locality || data.principalSubdivision || '';
                        const detectedCountryCode = (data.countryCode || 'AU').toUpperCase();

                        if (detectedCity) {
                            setFormData(prev => ({
                                ...prev,
                                country: detectedCountryCode,
                                city: detectedCity
                            }));
                            console.log('📍 Location detected (Auto):', detectedCity, detectedCountryCode);
                        }
                    }
                } catch (e) {
                    console.warn("Auto-detect city failed:", e.message);
                }
            }, (err) => {
                console.log("Location detection denied/failed", err);
            });
        }
    }, []);

    const handleLocationSelect = (placeData) => {
        setFormData(prev => ({
            ...prev,
            location: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng
        }));
    };

    const validateStep1 = () => {
        if (!formData.email || !formData.password || !formData.confirmPassword) {
            setError('Please fill in all fields');
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

            // Create Firestore user document with business account type
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: formData.email,
                accountType: 'business',
                role: 'partner',
                display_name: formData.businessName, // اسم المطعم مباشرة
                photo_url: null, // سيتم رفع اللوجو في Edit Profile
                created_at: serverTimestamp(),
                last_active_time: serverTimestamp(),
                businessInfo: {
                    // NO businessName - موجود في display_name
                    // NO logoImage - موجود في photo_url
                    businessType: formData.businessType,
                    phone: formData.phone,
                    city: formData.city, // من GPS (auto-detected)
                    country: formData.country, // من GPS (auto-detected)
                    description: '',
                    address: formData.location, // من LocationAutocomplete
                    coverImage: null,
                    lat: formData.lat, // من LocationAutocomplete (selected location)
                    lng: formData.lng, // من LocationAutocomplete (selected location)
                    placeId: null, // يمكن إضافته لاحقاً من LocationAutocomplete
                    isPublished: false, // Not published until profile is completed
                    createdAt: serverTimestamp()
                },
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

                        {/* Current Location Display - Simplified */}
                        <div style={{ marginBottom: '1rem' }}>
                            {formData.city ? (
                                <div style={{
                                    padding: '0.6rem 0.8rem',
                                    background: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-main)'
                                }}>
                                    <span>📍</span>
                                    <span>{formData.city}, {Country.getCountryByCode(formData.country)?.name}</span>
                                </div>
                            ) : (
                                <div style={{
                                    padding: '0.6rem 0.8rem',
                                    background: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    <span>⏳</span>
                                    <span>Detecting location...</span>
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
                            onClick={() => navigate('/edit-business-profile')}
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
