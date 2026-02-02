import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaImage, FaTimes, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaBirthdayCake, FaMoneyBillWave } from 'react-icons/fa';
import { IoMale, IoFemale, IoMaleFemale, IoPeople } from 'react-icons/io5';
import { HiUserGroup, HiUser } from 'react-icons/hi2';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ImageUpload from '../components/ImageUpload';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { Country, State, City } from 'country-state-city';
import { uploadInvitationPhoto } from '../utils/imageUpload';
import { validateInvitationCreation } from '../utils/invitationValidation';

const CreateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addInvitation } = useInvitations();
    const { currentUser } = useAuth();

    // UI State
    const [locationLoading, setLocationLoading] = useState(false);
    const [citySearchOpen, setCitySearchOpen] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const prefilledData = location.state?.prefilledData; // From PartnerProfile
    const fromRestaurant = location.state?.fromRestaurant || !!restaurantData;

    const [formData, setFormData] = useState({
        title: restaurantData
            ? `${t('dinner_at')} ${restaurantData.name}`
            : prefilledData?.restaurantName
                ? `${t('dinner_at')} ${prefilledData.restaurantName}`
                : '',
        restaurantId: restaurantData?.id || null,
        restaurantName: restaurantData?.name || prefilledData?.restaurantName || '',
        type: restaurantData?.type || 'Restaurant',
        country: 'GB',
        state: '',
        city: prefilledData?.city || '',
        date: '',
        time: '',
        location: restaurantData?.location || prefilledData?.location || '',
        guestsNeeded: 3,
        genderPreference: 'any',
        ageRange: 'any',
        paymentType: 'Split',
        description: '',
        image: restaurantData?.image || prefilledData?.restaurantImage || null,
        lat: restaurantData?.lat || prefilledData?.lat,
        lng: restaurantData?.lng || prefilledData?.lng,
        isFollowersOnly: false
    });

    // Update title when language changes if from restaurant
    useEffect(() => {
        if (restaurantData) {
            setFormData(prev => ({
                ...prev,
                title: `${t('dinner_at')} ${restaurantData.name}`
            }));
        }
    }, [i18n.language, restaurantData]);

    // Handle image selection
    const handleImageSelect = (file) => {
        setImageFile(file);
        // Create preview
        const reader = new FileReader();
        reader.onload = () => {
            setFormData(prev => ({ ...prev, image: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    // Remove image
    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, image: null }));
        setImageFile(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        // Validation
        if (!formData.title.trim()) {
            alert(t('please_enter_title'));
            return;
        }

        if (!formData.date || !formData.time) {
            alert(t('please_set_datetime'));
            return;
        }

        if (!formData.location.trim()) {
            alert(t('please_enter_location'));
            return;
        }

        // Check daily invitation limit
        const validation = await validateInvitationCreation(currentUser.uid);
        if (!validation.valid) {
            const confirmMessage = i18n.language === 'ar'
                ? `${validation.error}\n\n${t('go_to_current_invitation')}`
                : `${validation.error}\n\nDo you want to go to your current invitation?`;

            if (window.confirm(confirmMessage)) {
                navigate(`/invitation/${validation.existingInvitation.id}`);
            }
            return;
        }

        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            let finalImageUrl = formData.image;

            // Upload new image if selected
            if (imageFile) {
                const invitationId = `temp_${Date.now()}`; // Temporary ID for upload path
                const url = await uploadInvitationPhoto(
                    imageFile,
                    invitationId,
                    0,
                    (progress) => setUploadProgress(progress)
                );
                finalImageUrl = url;
            }

            const cleanData = { ...formData, image: finalImageUrl };
            const newId = await addInvitation(cleanData);

            if (newId) {
                navigate(`/invitation/${newId}`);
            }
        } catch (error) {
            console.error('Error creating invitation:', error);
            alert(t('failed_create_invitation'));
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    const generateTitle = (placeName) => {
        const prefix = t('invitation_at');
        return `${prefix} ${placeName}`;
    };

    const handleLocationSelect = (placeData) => {
        setFormData(prev => ({
            ...prev,
            location: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            title: generateTitle(placeData.name) // Auto-generate title
        }));
    };

    // Strict Auto-detect: Country is Mandatory
    useEffect(() => {
        if (!restaurantData && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
                    const data = await response.json();
                    if (data && data.address) {
                        const addr = data.address;

                        // 1. Force Detect Country Code
                        const detectedCountryCode = (addr.country_code).toUpperCase();

                        // Check if valid code in library
                        const countryData = Country.getCountryByCode(detectedCountryCode);
                        const validCountry = countryData ? detectedCountryCode : 'GB';

                        // 2. Default to first State/City
                        const states = State.getStatesOfCountry(validCountry);
                        const defaultState = states.length > 0 ? states[0].isoCode : ''; // Use ISO Code for state

                        const cities = defaultState ? City.getCitiesOfState(validCountry, defaultState) : [];
                        // Default city is empty to encourage manual search

                        setFormData(prev => ({
                            ...prev,
                            country: validCountry,
                            state: defaultState,
                            city: '',
                        }));
                    }
                } catch (e) {
                    console.error("Auto-detect location failed", e);
                }
            });
        }
    }, [restaurantData]);

    const handleStateChange = (e) => {
        const newStateCode = e.target.value;

        setFormData(prev => ({
            ...prev,
            state: newStateCode,
            city: '', // Reset to empty
            location: '', lat: null, lng: null
        }));
    };

    // Derived Data for UI
    const currentCountry = Country.getCountryByCode(formData.country);
    const availableStates = State.getStatesOfCountry(formData.country);
    const availableCities = City.getCitiesOfState(formData.country, formData.state);

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="page-container">
            <h2 style={{ marginBottom: '2rem', fontSize: '1.8rem', fontWeight: '900' }}>{t('create_invitation_title')}</h2>

            {fromRestaurant && restaurantData && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(244, 63, 94, 0.15))',
                    border: '1px solid var(--primary)',
                    borderRadius: '15px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FaCheckCircle style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_selected')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                            {restaurantData.name}
                        </div>
                    </div>
                </div>
            )}

            {/* Show prefilled venue from PartnerProfile */}
            {!fromRestaurant && prefilledData?.restaurantName && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(244, 63, 94, 0.15))',
                    border: '1px solid var(--primary)',
                    borderRadius: '15px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FaCheckCircle style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_selected')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                            {prefilledData.restaurantName}
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="create-form">

                {/* 1. Location Selection (State & City) - Moved Inside Form */}
                <div style={{
                    background: 'var(--card-bg)',
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🌍 {t('select_region_city')}
                    </h3>

                    {/* Country Badge */}
                    <div style={{
                        marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        <span>🔐 {t('current_region')}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{currentCountry?.name}</span>
                        <span>{currentCountry?.flag}</span>
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* State Selection */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.8rem' }}>{t('state_province')}</label>
                            <select
                                name="state"
                                value={formData.state}
                                onChange={handleStateChange}
                                className="input-field"
                                style={{ padding: '10px' }}
                            >
                                <option value="">{t('select_state')}</option>
                                {availableStates.map(st => (
                                    <option key={st.isoCode} value={st.isoCode}>{st.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* City Selection - Searchable */}
                        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                            <label style={{ fontSize: '0.8rem' }}>{t('city_search')}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, city: e.target.value, location: '', lat: null, lng: null }));
                                        setCitySearchOpen(true);
                                    }}
                                    onFocus={() => setCitySearchOpen(true)}
                                    onClick={() => setCitySearchOpen(true)}
                                    // Removed onBlur with timeout to rely on click handlers for better UX
                                    onBlur={() => setTimeout(() => setCitySearchOpen(false), 200)}
                                    className="input-field"
                                    style={{ padding: '10px', height: '48px', width: '100%' }}
                                    placeholder={t('type_to_search')}
                                />
                                <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                    ▼
                                </div>
                            </div>

                            {/* Searchable Dropdown Results */}
                            {citySearchOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    maxHeight: '250px',
                                    overflowY: 'auto',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '0 0 12px 12px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                                    zIndex: 100,
                                    border: '1px solid #e5e7eb'
                                }}>
                                    {availableCities
                                        .filter(c => c.name.toLowerCase().includes(formData.city.toLowerCase()))
                                        .slice(0, 100)
                                        .map(ct => (
                                            <div
                                                key={ct.name}
                                                onMouseDown={() => {
                                                    setFormData(prev => ({ ...prev, city: ct.name, location: '', lat: null, lng: null }));
                                                    setCitySearchOpen(false);
                                                }}
                                                style={{
                                                    padding: '12px 15px',
                                                    cursor: 'pointer',
                                                    color: '#111827',
                                                    borderBottom: '1px solid #f3f4f6',
                                                    fontSize: '0.9rem',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                            >
                                                {ct.name}
                                            </div>
                                        ))}
                                    {availableCities.filter(c => c.name.toLowerCase().includes(formData.city.toLowerCase())).length === 0 && (
                                        <div style={{ padding: '15px', color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>
                                            {t('no_matching_cities')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Specific Location (Search) - Moved Here */}
                    <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>{t('form_location_label')}</label>
                        <div style={{ display: 'flex' }}>
                            <div style={{ flex: 1 }}>
                                <LocationAutocomplete
                                    value={formData.location}
                                    onChange={handleChange}
                                    onSelect={handleLocationSelect}
                                    city={formData.city}
                                />
                            </div>
                        </div>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                            {t('location_helper_text') || 'Tip: Search for the venue name (e.g. Starbucks).'}
                        </small>
                    </div>
                </div>

                {/* 2. Invitation Title (New) */}
                <div className="form-group">
                    <label>{t('form_title_label')}</label>
                    <input
                        type="text"
                        name="title"
                        placeholder={t('form_title_placeholder')}
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="input-field"
                    />
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label>{t('form_type_label')}</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="input-field">
                            <option value="Restaurant">{t('type_restaurant')}</option>
                            <option value="Cafe">{t('type_cafe')}</option>
                            <option value="Cinema">{t('type_cinema')}</option>
                            <option value="Sports">{t('type_sports')}</option>
                            <option value="Entertainment">{t('type_entertainment')}</option>
                            <option value="Other">{t('type_other')}</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>{t('form_payment_label')}</label>
                        <select name="paymentType" value={formData.paymentType} onChange={handleChange} className="input-field">
                            <option value="Split">{t('payment_split')}</option>
                            <option value="Host Pays">{t('payment_host')}</option>
                            <option value="Each pays their own">{t('payment_own')}</option>
                        </select>
                    </div>
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label className="elegant-label">
                            <span className="label-icon">
                                <FaCalendarAlt />
                            </span>
                            {t('form_date_label')}
                        </label>
                        <input
                            type="date"
                            name="date"
                            min={today}
                            value={formData.date}
                            onChange={handleChange}
                            required
                            className="input-field"
                        />
                    </div>
                    <div className="form-group">
                        <label className="elegant-label">
                            <span className="label-icon">
                                <FaClock />
                            </span>
                            {t('form_time_label')}
                        </label>
                        <input
                            type="time"
                            name="time"
                            value={formData.time}
                            onChange={handleChange}
                            required
                            className="input-field"
                        />
                    </div>
                </div>



                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaUserFriends />
                        </span>
                        {t('form_guests_label')}
                    </label>
                    <input
                        type="number"
                        name="guestsNeeded"
                        min="1"
                        max="20"
                        value={formData.guestsNeeded}
                        onChange={handleChange}
                        required
                        className="input-field"
                    />
                </div>

                {/* Gender Preference */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaVenusMars />
                        </span>
                        {t('guest_gender_preference')}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, genderPreference: 'male' })}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: formData.genderPreference === 'male' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: formData.genderPreference === 'male' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <IoMale style={{ fontSize: '1.8rem', color: formData.genderPreference === 'male' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                {t('male')}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, genderPreference: 'female' })}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: formData.genderPreference === 'female' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: formData.genderPreference === 'female' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <IoFemale style={{ fontSize: '1.8rem', color: formData.genderPreference === 'female' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                {t('female')}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, genderPreference: 'any' })}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: formData.genderPreference === 'any' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: formData.genderPreference === 'any' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <IoMaleFemale style={{ fontSize: '1.8rem', color: formData.genderPreference === 'any' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                {t('any')}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Age Range Preference */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaBirthdayCake />
                        </span>
                        {t('age_range_preference')}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[
                            { value: '18-25', label: '18-25' },
                            { value: '26-35', label: '26-35' },
                            { value: '36-45', label: '36-45' },
                            { value: '46+', label: '46+' },
                            { value: 'any', label: t('any') }
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, ageRange: option.value })}
                                style={{
                                    padding: '14px 12px',
                                    borderRadius: '12px',
                                    border: formData.ageRange === option.value ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: formData.ageRange === option.value ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s',
                                    gridColumn: option.value === 'any' ? 'span 3' : 'span 1',
                                    minHeight: '70px'
                                }}
                            >
                                <HiUser style={{
                                    fontSize: '1.6rem',
                                    color: formData.ageRange === option.value ? 'var(--primary)' : 'var(--text-secondary)',
                                    marginBottom: '4px'
                                }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1.25rem', borderRadius: '15px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                        <input
                            type="checkbox"
                            name="isFollowersOnly"
                            checked={formData.isFollowersOnly || false}
                            onChange={(e) => setFormData({ ...formData, isFollowersOnly: e.target.checked })}
                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                        />
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                                {t('followers_only')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('followers_only_desc')}
                            </div>
                        </div>
                    </label>
                </div>

                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaImage />
                        </span>
                        {t('form_image_label')}
                    </label>
                    <ImageUpload
                        currentImage={formData.image}
                        onImageSelect={handleImageSelect}
                        onImageRemove={handleRemoveImage}
                        shape="square"
                        size="large"
                    />
                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{
                            marginTop: '12px',
                            background: 'var(--bg-card)',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)'
                            }}>
                                <span>{t('uploading')}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                background: 'var(--border-color)',
                                borderRadius: '3px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${uploadProgress}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                                    transition: 'width 0.3s ease',
                                    borderRadius: '3px'
                                }} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label>{t('form_details_label')}</label>
                    <textarea
                        name="description"
                        rows="4"
                        placeholder={t('form_details_placeholder')}
                        value={formData.description}
                        onChange={handleChange}
                        className="input-field text-area"
                    ></textarea>
                </div>

                <button type="submit" className="btn btn-primary btn-block" style={{ height: '60px', marginTop: '1rem', fontSize: '1.1rem' }} disabled={isSubmitting}>
                    {isSubmitting ? t('publishing') : t('submit_btn')}
                </button>
            </form >
        </div >
    );
};

export default CreateInvitation;
