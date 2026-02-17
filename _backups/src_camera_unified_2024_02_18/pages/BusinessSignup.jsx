import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStore, FaEnvelope, FaLock, FaPhone, FaMapMarkerAlt, FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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
            minHeight: '100vh',
            background: 'var(--bg-body)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '500px',
                background: 'var(--bg-card)',
                borderRadius: '24px',
                padding: '2.5rem',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        fontSize: '2.5rem'
                    }}>
                        <HiBuildingStorefront style={{ color: 'white' }} />
                    </div>
                    <h1 style={{
                        fontSize: '1.8rem',
                        fontWeight: '900',
                        marginBottom: '0.5rem',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Create Business Account
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        Join DineBuddies as a partner
                    </p>
                </div>

                {/* Progress Steps */}
                {step !== 3 && (
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        marginBottom: '2rem'
                    }}>
                        <div style={{
                            flex: 1,
                            height: '4px',
                            background: step >= 1 ? 'var(--primary)' : 'var(--border-color)',
                            borderRadius: '2px',
                            transition: 'all 0.3s'
                        }} />
                        <div style={{
                            flex: 1,
                            height: '4px',
                            background: step >= 2 ? 'var(--primary)' : 'var(--border-color)',
                            borderRadius: '2px',
                            transition: 'all 0.3s'
                        }} />
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        color: '#ef4444',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* Step 1: Account Info */}
                {step === 1 && (
                    <div>
                        <h3 style={{
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            marginBottom: '1.5rem',
                            color: 'var(--text-primary)'
                        }}>
                            Account Information
                        </h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Email Address
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '1rem'
                                }} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="business@example.com"
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem 1rem 0.9rem 3rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '1rem'
                                }} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem 1rem 0.9rem 3rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Confirm Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '1rem'
                                }} />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem 1rem 0.9rem 3rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleNext}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            marginBottom: '1.5rem',
                            color: 'var(--text-primary)'
                        }}>
                            Business Information
                        </h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Business Name *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FaStore style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '1rem'
                                }} />
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    placeholder="Your Business Name"
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem 1rem 0.9rem 3rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Business Type *
                            </label>
                            <select
                                name="businessType"
                                value={formData.businessType}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.9rem 1rem',
                                    background: 'var(--bg-body)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem'
                                }}
                            >
                                {businessTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Phone Number *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FaPhone style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontSize: '1rem'
                                }} />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="+1 234 567 8900"
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem 1rem 0.9rem 3rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Current Location Display */}
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Your Location
                            </label>

                            {formData.city ? (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>📍</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                            Detected City
                                        </div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                            {formData.city}, {Country.getCountryByCode(formData.country)?.name} {Country.getCountryByCode(formData.country)?.flag}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    background: 'var(--bg-body)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    <span>⏳</span>
                                    <span>Detecting your location...</span>
                                </div>
                            )}
                        </div>

                        {/* Business Address Search */}
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}>
                                Search for Your Business Address *
                            </label>
                            <LocationAutocomplete
                                value={formData.location}
                                onChange={handleChange}
                                onSelect={handleLocationSelect}
                                city={formData.city}
                                countryCode={formData.country}
                                userLat={formData.userLat}
                                userLng={formData.userLng}
                            />
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                                Search for your exact business location (restaurant, cafe, etc.)
                            </small>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleBack}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: 'var(--bg-body)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    fontWeight: '700',
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
                                    padding: '1rem',
                                    background: loading ? 'var(--bg-body)' : 'linear-gradient(135deg, var(--primary), #f97316)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                {loading ? 'Creating Account...' : 'Create Account'}
                                {!loading && <FaCheck />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 2rem',
                            fontSize: '3rem'
                        }}>
                            <FaCheck style={{ color: 'white' }} />
                        </div>
                        <h2 style={{
                            fontSize: '1.8rem',
                            fontWeight: '900',
                            marginBottom: '1rem',
                            color: 'var(--text-primary)'
                        }}>
                            Account Created!
                        </h2>
                        <p style={{
                            color: 'var(--text-secondary)',
                            marginBottom: '2rem',
                            lineHeight: '1.6'
                        }}>
                            Your business account has been created successfully.
                            Complete your profile to start connecting with customers!
                        </p>
                        <button
                            onClick={() => navigate('/edit-business-profile')}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                marginBottom: '1rem'
                            }}
                        >
                            Complete Your Profile
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}

                {/* Footer */}
                {step !== 3 && (
                    <div style={{
                        marginTop: '2rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid var(--border-color)',
                        textAlign: 'center'
                    }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Already have an account?{' '}
                            <span
                                onClick={() => navigate('/login')}
                                style={{
                                    color: 'var(--primary)',
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
