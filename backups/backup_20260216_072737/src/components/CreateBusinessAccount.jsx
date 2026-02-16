import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { FaTimes, FaSave, FaStore, FaEnvelope, FaLock, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import LocationAutocomplete from './LocationAutocomplete';

const CreateBusinessAccount = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1); // 1: Account Info, 2: Business Info

    const [formData, setFormData] = useState({
        // Account Info
        email: '',
        password: '',
        confirmPassword: '',

        // Business Info
        businessName: '',
        businessType: 'Restaurant',
        phone: '',
        location: '',
        city: '',
        country: 'AU', // Default to Australia
        countryCode: 'AU',
        lat: null,
        lng: null,
        userLat: null,
        userLng: null,
        subscriptionPlan: 'free'
    });

    // Get user's location and detect city/country automatically
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    setFormData(prev => ({
                        ...prev,
                        userLat: lat,
                        userLng: lng
                    }));

                    // Reverse geocode to get city and country
                    try {
                        const response = await fetch(
                            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
                        );

                        if (!response.ok) throw new Error('Geocoding failed');

                        const data = await response.json();

                        if (data) {
                            const city = data.city || data.locality || data.principalSubdivision || '';
                            const country = data.countryName || 'Australia';
                            const countryCode = (data.countryCode || 'AU').toUpperCase();

                            console.log('📍 Detected location (Auto):', { city, country, countryCode });

                            if (city) {
                                setFormData(prev => ({
                                    ...prev,
                                    city,
                                    country,
                                    countryCode,
                                    // Also set country in the dropdown if available
                                }));
                            }
                        }
                    } catch (error) {
                        console.error('Reverse geocoding failed:', error);
                    }
                },
                (error) => console.log('Location access denied:', error)
            );
        }
    }, []);

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleLocationSelect = (place) => {
        console.log('Selected place:', place);

        // Extract city and country from fullAddress
        let city = '';
        let country = '';

        if (place.fullAddress) {
            const parts = place.fullAddress.split(',').map(p => p.trim());
            // Usually: [Place Name, Street, City, Country]
            if (parts.length >= 2) {
                country = parts[parts.length - 1]; // Last part is usually country
                city = parts[parts.length - 2]; // Second to last is usually city
            }
        }

        setFormData(prev => ({
            ...prev,
            location: place.name,
            lat: place.lat,
            lng: place.lng,
            city: city || prev.city,
            country: country || prev.country
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
        if (!formData.businessName || !formData.phone || !formData.location) {
            setError('Please fill in all required fields');
            return false;
        }

        return true;
    };

    const handleNext = () => {
        setError('');
        if (step === 1 && validateStep1()) {
            setStep(2);
        }
    };

    const handleBack = () => {
        setError('');
        setStep(1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateStep2()) return;

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

            // Create Firestore document
            await setDoc(doc(db, 'users', user.uid), {
                email: formData.email,
                display_name: formData.businessName,
                accountType: 'business',
                role: 'partner',
                created_at: serverTimestamp(),
                last_active_time: serverTimestamp(),
                location: formData.lat && formData.lng ? {
                    latitude: formData.lat,
                    longitude: formData.lng,
                    city: formData.city,
                    country: formData.country
                } : null,
                businessInfo: {
                    businessName: formData.businessName,
                    businessType: formData.businessType,
                    phone: formData.phone,
                    city: formData.city,
                    country: formData.country,
                    address: formData.location,
                    subscriptionPlan: formData.subscriptionPlan,
                    memberCount: 0,
                    postsThisMonth: 0,
                    createdBy: 'admin',
                    createdAt: serverTimestamp()
                }
            });

            // Sign out the newly created user (admin stays logged in)
            await auth.signOut();

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error creating business account:', err);

            if (err.code === 'auth/email-already-in-use') {
                setError('Email already in use');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak');
            } else {
                setError(err.message || 'Failed to create account');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflow: 'auto',
                border: '1px solid var(--border-color)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-card)',
                    zIndex: 1
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.3rem',
                            fontWeight: '800',
                            marginBottom: '0.25rem',
                            color: 'var(--text-primary)'
                        }}>
                            Create Business Account
                        </h2>
                        <p style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                        }}>
                            Step {step} of 2
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            padding: '0.5rem'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        margin: '1rem 1.5rem 0',
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        color: '#ef4444',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                    {step === 1 && (
                        <>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                marginBottom: '1rem'
                            }}>
                                Account Information
                            </h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    <FaEnvelope style={{ marginRight: '0.5rem' }} />
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    <FaLock style={{ marginRight: '0.5rem' }} />
                                    Password
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    <FaLock style={{ marginRight: '0.5rem' }} />
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                marginBottom: '1rem'
                            }}>
                                Business Information
                            </h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    <FaStore style={{ marginRight: '0.5rem' }} />
                                    Business Name *
                                </label>
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    Business Type
                                </label>
                                <select
                                    name="businessType"
                                    value={formData.businessType}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="Restaurant">Restaurant</option>
                                    <option value="Cafe">Cafe</option>
                                    <option value="Bar">Bar</option>
                                    <option value="Fast Food">Fast Food</option>
                                    <option value="Fine Dining">Fine Dining</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    <FaPhone style={{ marginRight: '0.5rem' }} />
                                    Phone Number *
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            {/* Location Section - Unified Design */}
                            <div style={{
                                background: 'var(--bg-body)',
                                padding: '1.25rem',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                marginBottom: '1rem'
                            }}>
                                <h3 style={{
                                    fontSize: '1rem',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: 'var(--text-primary)'
                                }}>
                                    📍 Search for Business Location
                                </h3>

                                {/* Current Location Badge */}
                                {formData.city && (
                                    <div style={{
                                        marginBottom: '1rem',
                                        padding: '0.75rem',
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
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '2px'
                                            }}>
                                                Detected Location
                                            </div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                                {formData.city}{formData.country && `, ${formData.country}`}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Location Search */}
                                <div style={{ marginBottom: 0 }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Business Location *
                                    </label>
                                    <LocationAutocomplete
                                        value={formData.location}
                                        onChange={handleChange}
                                        onSelect={handleLocationSelect}
                                        city={formData.city}
                                        countryCode={formData.countryCode}
                                        userLat={formData.userLat}
                                        userLng={formData.userLng}
                                    />
                                    <small style={{
                                        color: 'var(--text-muted)',
                                        display: 'block',
                                        marginTop: '5px',
                                        fontSize: '0.8rem'
                                    }}>
                                        💡 Tip: Search for your business address or exact location
                                    </small>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    Initial Plan
                                </label>
                                <select
                                    name="subscriptionPlan"
                                    value={formData.subscriptionPlan}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="premium">Premium</option>
                                </select>
                            </div>
                        </>
                    )}
                </form>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '1rem',
                    position: 'sticky',
                    bottom: 0,
                    background: 'var(--bg-card)'
                }}>
                    {step === 2 && (
                        <button
                            onClick={handleBack}
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1
                            }}
                        >
                            Back
                        </button>
                    )}

                    {step === 1 ? (
                        <button
                            onClick={handleNext}
                            type="button"
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            style={{
                                flex: 2,
                                padding: '0.75rem',
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
                            <FaSave />
                            {loading ? 'Creating...' : 'Create Account'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateBusinessAccount;
