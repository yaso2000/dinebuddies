import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaImage, FaTimes, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaBirthdayCake, FaMoneyBillWave, FaLock, FaGlobe, FaPlus } from 'react-icons/fa';
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
    const { addInvitation, allUsers, currentUser } = useInvitations(); // Get currentUser from InvitationContext
    const { currentUser: authUser } = useAuth(); // Rename to authUser to avoid conflict

    // UI State
    const [locationLoading, setLocationLoading] = useState(false);
    const [citySearchOpen, setCitySearchOpen] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFriendSelector, setShowFriendSelector] = useState(false); // To toggle modal

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
        country: 'AU',
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
        privacy: 'public', // public, followers, private
        invitedUserIds: []
    });

    // Derived Friends List (Mutual Friends - المتابعة المتبادلة)
    // Only show people where: I follow them AND they follow me
    const friendsList = React.useMemo(() => {
        console.log('═══════════════════════════════════════');
        console.log('🔍 BUILDING FRIENDS LIST');
        console.log('═══════════════════════════════════════');
        console.log('Current User ID:', currentUser?.id);
        console.log('Current User Following:', currentUser?.following);
        console.log('Following Count:', currentUser?.following?.length || 0);
        console.log('All Users Count:', allUsers?.length || 0);
        console.log('All Users Sample:', allUsers?.slice(0, 2).map(u => ({
            id: u.id,
            name: u.display_name || u.name,
            following: u.following
        })));
        console.log('═══════════════════════════════════════');

        // Check if user is logged in properly
        if (!currentUser || !currentUser.id || currentUser.id === 'guest') {
            console.error('❌ USER NOT LOGGED IN OR GUEST:', {
                currentUser,
                id: currentUser?.id
            });
            return [];
        }

        if (!currentUser?.following || !allUsers || !currentUser?.id) {
            console.error('❌ MISSING DATA:', {
                hasFollowing: !!currentUser?.following,
                followingValue: currentUser?.following,
                hasAllUsers: !!allUsers,
                allUsersCount: allUsers?.length,
                hasCurrentUserId: !!currentUser?.id,
                currentUserId: currentUser?.id
            });
            return [];
        }

        // Filter for MUTUAL friends only
        const mutualFriends = allUsers.filter(u => {
            // Skip self
            if (u.id === currentUser.id) return false;

            // I must be following them
            const iFollowThem = currentUser.following && currentUser.following.includes(u.id);

            if (!iFollowThem) return false; // Skip if I don't follow them

            // They must be following me back
            // Check if they have a following field and it's an array
            const theirFollowing = u.following;
            const hasFollowingField = theirFollowing !== undefined && theirFollowing !== null;
            const isArray = Array.isArray(theirFollowing);
            const theyFollowMe = hasFollowingField && isArray && theirFollowing.includes(currentUser.id);

            const isMutual = theyFollowMe;

            // Detailed logging for debugging
            console.log(`👤 User ${u.display_name || u.name || u.id}:`, {
                userId: u.id,
                display_name: u.display_name,
                name: u.name,
                iFollowThem: true, // We already checked this above
                hasFollowingField,
                isFollowingArray: isArray,
                theirFollowing,
                theirFollowingLength: isArray ? theirFollowing.length : 'N/A',
                currentUserId: currentUser.id,
                doesIncludeMe: isArray ? theirFollowing.includes(currentUser.id) : false,
                theyFollowMe,
                isMutual,
                '⚠️ ISSUE': !hasFollowingField ? 'NO FOLLOWING FIELD IN FIRESTORE' : (!isArray ? 'FOLLOWING IS NOT AN ARRAY' : (!theyFollowMe ? `THEY DO NOT FOLLOW YOU BACK (looking for: ${currentUser.id})` : null)),
                'DEBUG_IDs': {
                    myId: currentUser.id,
                    theirFollowingArray: theirFollowing,
                    exactMatch: isArray && theirFollowing.map(id => ({
                        id,
                        matches: id === currentUser.id,
                        idType: typeof id,
                        myIdType: typeof currentUser.id
                    }))
                }
            });

            return isMutual;
        });

        console.log('✅ Mutual friends list built:', {
            count: mutualFriends.length,
            totalFollowing: currentUser.following?.length || 0,
            totalUsers: allUsers.length,
            friends: mutualFriends.map(f => ({
                id: f.id,
                name: f.display_name || f.name,
                following: f.following
            }))
        });

        if (mutualFriends.length === 0 && currentUser.following?.length > 0) {
            console.warn('⚠️ WARNING: You are following people but none of them follow you back, OR their following data is missing in Firestore');
        }

        return mutualFriends;
    }, [currentUser?.following, allUsers, currentUser?.id]);

    // Handle friend selection
    const handleFriendToggle = (userId) => {
        setFormData(prev => {
            const currentSelected = prev.invitedUserIds || [];
            if (currentSelected.includes(userId)) {
                return { ...prev, invitedUserIds: currentSelected.filter(id => id !== userId) };
            } else {
                return { ...prev, invitedUserIds: [...currentSelected, userId] };
            }
        });
    };

    // Debug: Log when friend selector opens
    useEffect(() => {
        if (showFriendSelector) {
            const debugInfo = {
                friendsListCount: friendsList.length,
                currentUserFollowingCount: currentUser?.following?.length || 0,
                allUsersCount: allUsers?.length || 0
            };

            console.log('🔍 Friend Selector Opened - Current State:', {
                ...debugInfo,
                friendsList: friendsList,
                currentUserFollowing: currentUser?.following,
                allUsersCount: allUsers?.length
            });

            // Visual alert for debugging
            if (friendsList.length === 0 && currentUser?.following?.length > 0) {
                console.error(`
                    ⚠️ PROBLEM DETECTED:
                    - You are following: ${currentUser.following.length} people
                    - Mutual friends found: 0
                    - Total users in database: ${allUsers?.length || 0}
                    
                    Check the console logs above (👤 User ...) to see why each person is not showing.
                `);
            }
        }
    }, [showFriendSelector, friendsList, currentUser, allUsers]);

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

        if (formData.privacy === 'private' && (!formData.invitedUserIds || formData.invitedUserIds.length === 0)) {
            alert(t('please_select_friends') || 'Please select at least one friend for private invitation.');
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

            const cleanData = {
                ...formData,
                image: finalImageUrl,
                isFollowersOnly: formData.privacy === 'followers' // Backward compatibility
                // privacy: formData.privacy, // Already getting spread from formData
                // invitedUserIds: formData.invitedUserIds // Already getting spread
            };

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

    // Auto-detect user location and set city + coordinates
    useEffect(() => {
        if (!restaurantData && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
                    const data = await response.json();
                    if (data && data.address) {
                        const addr = data.address;

                        // Get city name
                        const detectedCity = addr.city || addr.town || addr.village || addr.suburb || '';

                        // Get country code
                        const detectedCountryCode = (addr.country_code || 'au').toUpperCase();

                        // Check if valid code in library
                        const countryData = Country.getCountryByCode(detectedCountryCode);
                        const validCountry = countryData ? detectedCountryCode : 'AU';

                        console.log('📍 Auto-detected location:', {
                            city: detectedCity,
                            country: validCountry,
                            lat: latitude,
                            lng: longitude
                        });

                        setFormData(prev => ({
                            ...prev,
                            country: validCountry,
                            city: detectedCity,
                            // Store user's current coordinates for location bias
                            userLat: latitude,
                            userLng: longitude
                        }));
                    }
                } catch (e) {
                    console.error("Auto-detect location failed", e);
                }
            });
        }
    }, [restaurantData]);

    // Derived Data for UI
    const currentCountry = Country.getCountryByCode(formData.country);

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

                {/* Location Search - Simplified */}
                <div style={{
                    background: 'var(--card-bg)',
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📍 {t('search_venue') || 'Search for a Venue'}
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
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                    {t('your_location') || 'Your Location'}
                                </div>
                                <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                    {formData.city}, {currentCountry?.name} {currentCountry?.flag}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Venue Search */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>{t('form_location_label')}</label>
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
                            {t('location_helper_text') || 'Search for restaurants, cafes, or venues near you'}
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

                {/* Privacy Settings */}
                <div className="form-group" style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem' }}>
                        <span className="label-icon"><FaLock /></span>
                        {t('privacy_settings') || 'Privacy Settings'}
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {['public', 'followers', 'private'].map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setFormData({ ...formData, privacy: mode })}
                                style={{
                                    padding: '12px 8px',
                                    borderRadius: '12px',
                                    border: formData.privacy === mode ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: formData.privacy === mode ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Icons */}
                                {mode === 'public' && <FaGlobe style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                {mode === 'followers' && <FaUserFriends style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                {mode === 'private' && <FaLock style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}

                                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                    {mode === 'public' ? (t('public') || 'Public') :
                                        mode === 'followers' ? (t('followers_only') || 'Followers') :
                                            (t('private') || 'Private')}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Private Mode: Select Friends */}
                    {formData.privacy === 'private' && (
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {t('select_specific_friends') || 'Select Friends to Invite'}
                            </label>

                            {/* Friends List - Inline */}
                            <div style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '1rem',
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}>
                                {(() => {
                                    console.log('🎯 RENDERING FRIENDS LIST:', {
                                        friendsListLength: friendsList.length,
                                        friendsList: friendsList,
                                        currentUserId: currentUser?.id,
                                        currentUserFollowing: currentUser?.following,
                                        allUsersCount: allUsers?.length
                                    });
                                    return null;
                                })()}

                                {friendsList.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                        <FaUserFriends style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
                                        <p style={{ margin: 0, marginBottom: '1rem' }}>
                                            {t('no_friends_found_desc') || 'You need mutual friends to invite them privately.'}
                                        </p>
                                        <small style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                            (People who follow you AND you follow them)
                                        </small>

                                        {/* Debug Info */}
                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1rem',
                                            background: 'rgba(255,0,0,0.1)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            textAlign: 'left'
                                        }}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#ef4444' }}>
                                                🔍 Debug Info:
                                            </div>
                                            <div>Your ID: {currentUser?.id || 'N/A'}</div>
                                            <div>You follow: {currentUser?.following?.length || 0} people</div>
                                            <div>Following IDs: {JSON.stringify(currentUser?.following || [])}</div>
                                            <div>Total users in DB: {allUsers?.length || 0}</div>
                                            <div>Mutual friends found: {friendsList.length}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {friendsList.length} {friendsList.length === 1 ? 'friend' : 'friends'} available
                                        </div>
                                        {friendsList.map(friend => {
                                            const friendName = friend.display_name || friend.name || 'User';
                                            const friendAvatar = friend.photo_url || friend.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default&backgroundColor=b6e3f4';
                                            const friendUsername = friendName.replace(/\s/g, '').toLowerCase();
                                            const isSelected = formData.invitedUserIds.includes(friend.id);

                                            return (
                                                <div
                                                    key={friend.id}
                                                    onClick={() => handleFriendToggle(friend.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '10px',
                                                        borderRadius: '12px',
                                                        background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                                                        cursor: 'pointer',
                                                        marginBottom: '8px',
                                                        border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                                    }}
                                                >
                                                    <img
                                                        src={friendAvatar}
                                                        alt={friendName}
                                                        style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: '50%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>
                                                            {friendName}
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                            @{friendUsername}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        border: isSelected ? 'none' : '2px solid var(--text-muted)',
                                                        background: isSelected ? 'var(--primary)' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {isSelected && <FaCheckCircle style={{ color: 'white', fontSize: '1rem' }} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {formData.invitedUserIds.length > 0 && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    borderRadius: '8px',
                                    color: 'var(--primary)',
                                    fontSize: '0.85rem',
                                    textAlign: 'center'
                                }}>
                                    ✓ {formData.invitedUserIds.length} {formData.invitedUserIds.length === 1 ? 'friend' : 'friends'} selected
                                </div>
                            )}
                        </div>
                    )}
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
