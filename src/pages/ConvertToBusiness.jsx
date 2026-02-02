import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBuilding, FaPhone, FaMapMarkerAlt, FaCity, FaClock, FaArrowLeft, FaMap } from 'react-icons/fa';
import { HiBuildingStorefront, HiHomeModern } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';

const ConvertToBusiness = () => {
    const navigate = useNavigate();
    const { currentUser, convertToBusiness } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        businessName: '',
        businessType: 'Restaurant',
        description: '',
        phone: '',
        address: '',
        city: '',
        district: '',
        unitNumber: '',
        workingHours: {
            sunday: { open: '09:00', close: '22:00', isOpen: true },
            monday: { open: '09:00', close: '22:00', isOpen: true },
            tuesday: { open: '09:00', close: '22:00', isOpen: true },
            wednesday: { open: '09:00', close: '22:00', isOpen: true },
            thursday: { open: '09:00', close: '22:00', isOpen: true },
            friday: { open: '09:00', close: '22:00', isOpen: true },
            saturday: { open: '09:00', close: '22:00', isOpen: true }
        }
    });

    const businessTypes = [
        'Restaurant',
        'Cafe',
        'Hotel',
        'Activity Center',
        'Salon',
        'Gym',
        'Event Hall',
        'Other'
    ];

    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [detectingLocation, setDetectingLocation] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Address Search Handler (Nominatim OpenStreetMap)
    const handleAddressChange = async (e) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, address: value }));

        if (value.length > 2) {
            try {
                // Biasing search to the entered city if available
                const query = formData.city ? `${value}, ${formData.city}` : value;
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();
                setAddressSuggestions(data);
            } catch (err) {
                console.error("Address search error:", err);
            }
        } else {
            setAddressSuggestions([]);
        }
    };

    const selectAddress = (suggestion) => {
        const address = suggestion.display_name;

        fetch(`https://nominatim.openstreetmap.org/details.php?place_id=${suggestion.place_id}&format=json`)
            .then(res => res.json())
            .then(details => {
                const city = details.address?.city || details.address?.town || details.address?.village || details.address?.state || '';
                const district = details.address?.suburb || details.address?.district || details.address?.neighbourhood || '';

                setFormData(prev => ({
                    ...prev,
                    address: address,
                    city: city || prev.city,
                    district: district,
                    coordinates: {
                        lat: parseFloat(suggestion.lat),
                        lng: parseFloat(suggestion.lon)
                    }
                }));
            })
            .catch(() => {
                // Fallback if details fail
                setFormData(prev => ({
                    ...prev,
                    address: address,
                    coordinates: {
                        lat: parseFloat(suggestion.lat),
                        lng: parseFloat(suggestion.lon)
                    }
                }));
            });

        setAddressSuggestions([]);
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            return;
        }

        setDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();

                    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state || '';
                    const district = data.address?.suburb || data.address?.district || data.address?.neighbourhood || '';

                    setFormData(prev => ({
                        ...prev,
                        address: data.display_name,
                        city: city,
                        district: district,
                        coordinates: {
                            lat: latitude,
                            lng: longitude
                        }
                    }));
                } catch (err) {
                    console.error("Reverse geocoding error:", err);
                    setError("Failed to fetch address details");
                } finally {
                    setDetectingLocation(false);
                }
            },
            (err) => {
                console.error("Geolocation error:", err);
                setError("Unable to retrieve your location");
                setDetectingLocation(false);
            }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.businessName.trim()) {
            setError('Please enter business name');
            return;
        }

        if (!formData.phone.trim()) {
            setError('Please enter phone number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await convertToBusiness(formData);
            // Redirect to profile page
            navigate('/business-profile');
        } catch (err) {
            console.error('Error converting to business:', err);
            setError(t('conversion_error'));
            setLoading(false);
        }
    };

    // If already a business account
    if (currentUser?.accountType === 'business') {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <HiBuildingStorefront style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2>{t('already_business')}</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {t('manage_business')}
                </p>
                <button
                    onClick={() => navigate('/profile')}
                    className="btn btn-primary"
                    style={{ marginTop: '1.5rem' }}
                >
                    {t('go_to_profile')}
                </button>
            </div>
        );
    }

    return (
        <div className="page-container" style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass" style={{ position: 'sticky', top: 0, zIndex: 100, marginBottom: '1.5rem' }}>
                <button className="back-btn" onClick={() => navigate('/settings')} aria-label="Go back">
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Convert to Business Account</h3>
                </div>
                <div style={{ width: '40px' }}></div>
            </header>

            {/* Info Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
                textAlign: 'center'
            }}>
                <HiBuildingStorefront style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '0.5rem' }} />
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Convert Your Account to Business</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Get a professional page for your business, share menu & offers, and engage with customers
                </p>
            </div>

            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    color: '#ef4444'
                }}>
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Business Name */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaBuilding />
                        </span>
                        Business Name *
                    </label>
                    <input
                        type="text"
                        name="businessName"
                        value={formData.businessName}
                        onChange={handleChange}
                        placeholder="e.g. Luxury Restaurant"
                        className="input-field"
                        required
                    />
                </div>

                {/* Business Type */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <HiBuildingStorefront />
                        </span>
                        Business Type *
                    </label>
                    <select
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleChange}
                        className="input-field"
                        required
                    >
                        {businessTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Description */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            📝
                        </span>
                        Business Description
                    </label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Tell us about your business..."
                        className="input-field"
                        rows="4"
                        style={{ resize: 'vertical' }}
                    />
                </div>

                {/* Phone */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaPhone />
                        </span>
                        Phone Number *
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+966 50 123 4567"
                        className="input-field"
                        required
                    />
                </div>

                {/* City & District */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="elegant-label">
                            <span className="label-icon">
                                <FaCity />
                            </span>
                            City
                        </label>
                        <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            placeholder="e.g. Riyadh"
                            className="input-field"
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="elegant-label">
                            <span className="label-icon">
                                <FaMap />
                            </span>
                            District / Area
                        </label>
                        <input
                            type="text"
                            name="district"
                            value={formData.district}
                            onChange={handleChange}
                            placeholder="e.g. Al Olaya"
                            className="input-field"
                        />
                    </div>
                </div>

                {/* Unit & Address Row */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {/* Unit Number - Small Box */}
                    <div className="form-group" style={{ width: '120px', flexShrink: 0 }}>
                        <label className="elegant-label">
                            <span className="label-icon">
                                <HiHomeModern />
                            </span>
                            Unit No.
                        </label>
                        <input
                            type="text"
                            name="unitNumber"
                            value={formData.unitNumber}
                            onChange={handleChange}
                            placeholder="Unit 1"
                            className="input-field"
                            style={{ textAlign: 'center' }}
                        />
                    </div>

                    {/* Address with Search & Auto-detect */}
                    <div className="form-group" style={{ position: 'relative', flex: 1 }}>
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span className="label-icon"><FaMapMarkerAlt /></span>
                                Address
                            </div>
                            <button
                                type="button"
                                onClick={handleDetectLocation}
                                disabled={detectingLocation}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {detectingLocation ? '...' : <><span style={{ fontSize: '0.9rem' }}>📍</span> Detect</>}
                            </button>
                        </label>

                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleAddressChange}
                                placeholder="Search address..."
                                className="input-field"
                                autoComplete="off"
                            />
                            {/* Address Suggestions Dropdown */}
                            {addressSuggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    marginTop: '4px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 1000,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                }}>
                                    {addressSuggestions.map((suggestion, index) => (
                                        <div
                                            key={index}
                                            onClick={() => selectAddress(suggestion)}
                                            style={{
                                                padding: '10px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--border-color)',
                                                fontSize: '0.9rem',
                                                transition: 'background 0.2s',
                                                color: 'var(--text-primary)'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.1)'}
                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                        >
                                            {suggestion.display_name}
                                        </div>
                                    ))}
                                    {/* Manual Entry Option */}
                                    <div
                                        onClick={() => {
                                            setAddressSuggestions([]);
                                            // Keep current text, clear coords if any were set by previous auto-select
                                            // The user is choosing to trust their own text input
                                            setFormData(prev => ({ ...prev, coordinates: null }));
                                        }}
                                        style={{
                                            padding: '10px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 'bold',
                                            color: 'var(--primary)',
                                            background: 'rgba(var(--primary-rgb), 0.05)',
                                            borderTop: '1px solid var(--border-color)'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
                                        onMouseLeave={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.05)'}
                                    >
                                        ✍️ Use "{formData.address}" manually
                                    </div>
                                </div>
                            )}
                        </div>
                        {formData.coordinates && (
                            <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                ✓ Precise
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Note */}
                <div style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                }}>
                    💡 You can edit working hours and other details from your profile after conversion
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/settings')}
                        className="btn btn-outline"
                        style={{ flex: 1 }}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, var(--primary), #f97316)'
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Converting...' : 'Convert Account'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ConvertToBusiness;
