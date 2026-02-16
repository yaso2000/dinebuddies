import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaImage, FaTimes, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaBirthdayCake, FaMoneyBillWave, FaLock, FaGlobe, FaPlus } from 'react-icons/fa';
import { IoMale, IoFemale, IoMaleFemale, IoPeople } from 'react-icons/io5';
import { HiUserGroup, HiUser } from 'react-icons/hi2';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ImageUpload from '../components/ImageUpload';
import MediaSelector from '../components/Invitations/MediaSelector';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { Country, State, City } from 'country-state-city';
import { uploadInvitationPhoto } from '../utils/imageUpload';
import { processInvitationMedia } from '../services/mediaService';
import { validateInvitationCreation } from '../utils/invitationValidation';
import { canCreateInvitation } from '../utils/cancellationPolicy';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const CreateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addInvitation, allUsers, currentUser } = useInvitations(); // Get currentUser from InvitationContext
    const { currentUser: authUser, userProfile } = useAuth(); // Get userProfile for guest check

    // Redirect guests to login immediately
    useEffect(() => {
        if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            navigate('/login');
        }
    }, [userProfile, currentUser, navigate]);

    // UI State
    const [locationLoading, setLocationLoading] = useState(false);
    const [citySearchOpen, setCitySearchOpen] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [mediaData, setMediaData] = useState(null); // NEW: For MediaSelector
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFriendSelector, setShowFriendSelector] = useState(false); // To toggle modal
    const [restrictionInfo, setRestrictionInfo] = useState(null); // Cancellation restriction info
    const [suggestedImages, setSuggestedImages] = useState([]); // Suggested venue images

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const prefilledData = location.state?.prefilledData; // From PartnerProfile
    const offerData = location.state?.offerData; // From Special Offer
    const fromRestaurant = location.state?.fromRestaurant || !!restaurantData;
    const editingDraft = location.state?.editingDraft; // Editing draft from preview
    const draftId = location.state?.draftId; // Draft ID to load

    const [formData, setFormData] = useState({
        title: offerData?.title
            ? offerData.title
            : restaurantData
                ? `${t('dinner_at')} ${restaurantData.name}`
                : prefilledData?.restaurantName
                    ? `${t('dinner_at')} ${prefilledData.restaurantName}`
                    : '',
        restaurantId: restaurantData?.id || offerData?.partnerId || null,
        restaurantName: restaurantData?.name || prefilledData?.restaurantName || offerData?.location || '',
        type: restaurantData?.type || 'Restaurant',
        country: '',
        state: '',
        city: prefilledData?.city || restaurantData?.city || offerData?.city || '',
        date: '',
        time: '',
        // Get location from multiple possible sources
        location: offerData?.locationDetails || offerData?.location || restaurantData?.address || restaurantData?.location || prefilledData?.location || '',
        guestsNeeded: 3,
        genderPreference: 'any',
        ageRange: 'any',
        paymentType: 'Split',
        description: offerData?.description || '',
        image: offerData?.image || restaurantData?.image || prefilledData?.restaurantImage || null,
        // Get coordinates from multiple possible sources
        lat: offerData?.lat || restaurantData?.lat || restaurantData?.coordinates?.lat || prefilledData?.lat,
        lng: offerData?.lng || restaurantData?.lng || restaurantData?.coordinates?.lng || prefilledData?.lng,
        privacy: 'public',
        invitedUserIds: [],
        // Special Offer constraints
        minDate: offerData?.startDate || null,
        maxDate: offerData?.endDate || null,
        offerId: offerData?.offerId || null
    });

    // Load draft if editing
    useEffect(() => {
        const loadDraft = async () => {
            if (editingDraft && draftId) {
                try {
                    const invitationRef = doc(db, 'invitations', draftId);
                    const invitationDoc = await getDoc(invitationRef);

                    if (invitationDoc.exists()) {
                        const draft = invitationDoc.data();
                        setFormData({
                            ...draft,
                            invitedUserIds: draft.invitedUserIds || []
                        });
                    }
                } catch (error) {
                    console.error('Error loading draft:', error);
                }
            }
        };

        loadDraft();
    }, [editingDraft, draftId]);

    // Derived Friends List (Mutual Friends - المتابعة المتبادلة)
    // Only show people where: I follow them AND they follow me
    const friendsList = React.useMemo(() => {

        // Check if user is logged in properly
        if (!currentUser || !currentUser.id || currentUser.id === 'guest') {
            return [];
        }

        if (!currentUser?.following || !allUsers || !currentUser?.id) {
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

            return isMutual;
        });

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

    const handlePreview = async (e) => {
        e.preventDefault();
        console.log('🔍 handlePreview called');

        // Check if user is guest
        if (!currentUser || currentUser.id === 'guest' || !authUser) {
            console.error('❌ Guest user cannot create invitations');
            alert(t('login_to_create') || 'Please login to create an invitation');
            navigate('/login');
            return;
        }

        if (isSubmitting) {
            console.log('⚠️ Already submitting, returning');
            return;
        }

        // Validation
        if (!formData.title.trim()) {
            console.log('❌ Title validation failed');
            alert(t('please_enter_title'));
            return;
        }

        if (!formData.date || !formData.time) {
            console.log('❌ Date/Time validation failed');
            alert(t('please_set_datetime'));
            return;
        }

        if (!formData.location.trim()) {
            console.log('❌ Location validation failed');
            alert(t('please_enter_location'));
            return;
        }

        if (formData.privacy === 'private' && (!formData.invitedUserIds || formData.invitedUserIds.length === 0)) {
            console.log('❌ Private invitation validation failed');
            alert(t('please_select_friends') || 'Please select at least one friend for private invitation.');
            return;
        }

        // Check for cancellation restrictions
        if (restrictionInfo && !restrictionInfo.canCreate) {
            console.log('❌ Restriction check failed');
            alert(t('cannot_create_restricted', {
                date: restrictionInfo.until?.toLocaleDateString()
            }));
            return;
        }

        // Check daily invitation limit
        console.log('✅ Starting validation check...');
        const validation = await validateInvitationCreation(currentUser.uid);
        if (!validation.valid) {
            console.log('❌ Daily limit validation failed:', validation.error);
            const confirmMessage = i18n.language === 'ar'
                ? `${validation.error}\n\n${t('go_to_current_invitation')}`
                : `${validation.error}\n\nDo you want to go to your current invitation?`;

            if (window.confirm(confirmMessage)) {
                navigate(`/invitation/${validation.existingInvitation.id}`);
            }
            return;
        }

        console.log('✅ All validations passed, starting submission...');
        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            let mediaFields = {};

            // Process media (image or video)
            if (mediaData) {
                console.log('📤 Processing media...');
                setUploadProgress(20);

                try {
                    // Use the correct userId
                    const userId = currentUser?.id || authUser?.uid;

                    if (!userId) {
                        throw new Error('User not authenticated');
                    }

                    console.log('👤 Using User ID:', userId);
                    mediaFields = await processInvitationMedia(mediaData, userId);
                    console.log('✅ Media processed:', mediaFields);
                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    throw new Error(t('media_upload_failed') || 'Failed to upload media');
                }

                setUploadProgress(60);
            } else if (formData.image) {
                // Fallback: existing image URL
                mediaFields = {
                    mediaSource: 'restaurant',
                    restaurantImage: formData.image,
                    mediaType: 'image'
                };
            }

            const draftData = {
                ...formData,
                ...mediaFields, // Merge media fields
                isFollowersOnly: formData.privacy === 'followers',
                status: 'draft' // Mark as draft
            };

            // Remove old image field if exists
            if (draftData.image) {
                delete draftData.image;
            }

            console.log('📝 Creating draft with data:', draftData);

            let finalDraftId;

            if (editingDraft && draftId) {
                // Update existing draft
                console.log('🔄 Updating existing draft:', draftId);
                const { updateDoc } = await import('firebase/firestore');
                const invitationRef = doc(db, 'invitations', draftId);
                await updateDoc(invitationRef, draftData);
                finalDraftId = draftId;
            } else {
                // Create new draft
                console.log('➕ Creating new draft...');
                finalDraftId = await addInvitation(draftData);
                console.log('✅ Draft created with ID:', finalDraftId);
            }

            if (finalDraftId) {
                // Navigate to preview with draft ID
                console.log('🚀 Navigating to preview:', `/invitation/preview/${finalDraftId}`);
                navigate(`/invitation/preview/${finalDraftId}`);
            } else {
                console.error('❌ No draft ID returned!');
            }
        } catch (error) {
            console.error('❌ Error creating draft:', error);
            alert(error.message || t('failed_create_invitation'));
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    // Keep original handleSubmit for backward compatibility (if needed)
    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('🚀 Publishing invitation directly...');

        if (isSubmitting) return;

        // Check if user is guest
        if (!currentUser || currentUser.id === 'guest' || !authUser) {
            console.error('❌ Guest user cannot create invitations');
            alert(t('login_to_create') || 'Please login to create an invitation');
            navigate('/login');
            return;
        }

        // Validation (This part is now handled by handlePreview, but keeping it here for direct submission if needed)
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

        // Check for cancellation restrictions
        if (restrictionInfo && !restrictionInfo.canCreate) {
            alert(t('cannot_create_restricted', {
                date: restrictionInfo.until?.toLocaleDateString()
            }));
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
                console.log('📤 Uploading image...');
                const invitationId = `temp_${Date.now()}`; // Temporary ID for upload path
                const url = await uploadInvitationPhoto(
                    imageFile,
                    invitationId,
                    0,
                    (progress) => setUploadProgress(progress)
                );
                finalImageUrl = url;
                console.log('✅ Image uploaded:', url);
            }

            const cleanData = {
                ...formData,
                image: finalImageUrl,
                isFollowersOnly: formData.privacy === 'followers' // Backward compatibility
                // privacy: formData.privacy, // Already getting spread from formData
                // invitedUserIds: formData.invitedUserIds // Already getting spread
            };

            console.log('📝 Creating invitation with data:', cleanData);
            const newId = await addInvitation(cleanData);
            console.log('✅ Invitation created with ID:', newId);

            if (newId) {
                console.log('🔄 Navigating to invitation:', `/invitation/${newId}`);
                navigate(`/invitation/${newId}`);
            } else {
                console.error('❌ No invitation ID returned!');
            }
        } catch (error) {
            console.error('❌ Error creating invitation:', error);
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

        // Handle Suggested Images
        if (placeData.photos && placeData.photos.length > 0) {
            setSuggestedImages(placeData.photos);
        } else {
            // Fallback Stock Images for manual or photo-less places
            setSuggestedImages([
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500',
                'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=500',
                'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=500',
                'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500'
            ]);
        }
    };

    // Auto-detect user location - REPLACED WITH IMPLICIT PROFILE LOCATION
    /*
    useEffect(() => {
        if (!restaurantData && navigator.geolocation) {
           // ... (Browser Geolocation Logic Disabled) ...
        }
    }, [restaurantData]);
    */

    // Use Implicit User Location from Profile OR IP Fallback
    useEffect(() => {
        const setLocationFromProfile = () => {
            if (userProfile?.city && userProfile?.coordinates) {
                console.log('📍 Using Implicit Profile Location:', userProfile.city);
                setFormData(prev => ({
                    ...prev,
                    city: userProfile.city || prev.city,
                    country: userProfile.countryCode || prev.country || '',
                    userLat: userProfile.coordinates.lat,
                    userLng: userProfile.coordinates.lng,
                }));
                return true;
            }
            return false;
        };

        const fetchIpLocation = async () => {
            try {
                console.log('🌐 Fetching IP-based location (Hidden Fallback)...');
                const response = await fetch('https://ipwho.is/');
                const data = await response.json();

                if (data.success) {
                    console.log('✅ IP Location found:', data.city, data.country_code);
                    setFormData(prev => ({
                        ...prev,
                        city: data.city,
                        country: data.country_code,
                        userLat: data.latitude,
                        userLng: data.longitude
                    }));
                } else {
                    console.warn('❌ IP Location failed:', data.message);
                }
            } catch (error) {
                console.error('❌ IP Location Error:', error);
            }
        };

        if (!restaurantData) {
            // 1. Try Profile First
            const profileFound = setLocationFromProfile();

            // 2. If no profile location, use IP Fallback
            if (!profileFound) {
                fetchIpLocation();
            }
        }
    }, [userProfile, restaurantData]);

    // Check for cancellation restrictions
    useEffect(() => {
        const checkRestrictions = async () => {
            if (currentUser && currentUser.id && currentUser.id !== 'guest') {
                const permission = await canCreateInvitation(currentUser.id);
                if (!permission.canCreate) {
                    setRestrictionInfo(permission);
                }
            }
        };

        checkRestrictions();
    }, [currentUser]);

    // Derived Data for UI
    const currentCountry = Country.getCountryByCode(formData.country);

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="page-container">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '900' }}>{t('create_invitation_title')}</h2>

            {/* Restriction Warning Banner */}
            {restrictionInfo && !restrictionInfo.canCreate && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))',
                    border: '2px solid #ef4444',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem'
                }}>
                    <div style={{ fontSize: '2rem' }}>⛔</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ef4444', marginBottom: '0.5rem' }}>
                            {t('account_restricted')}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                            {restrictionInfo.reason}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>⏰</span>
                            <span>{t('restriction_info', { days: restrictionInfo.daysLeft })}</span>
                        </div>
                    </div>
                </div>
            )}

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
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
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
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            {prefilledData.restaurantName}
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handlePreview} className="create-form">

                {/* 1. Location Search - FIRST STEP */}
                <div style={{
                    background: 'var(--card-bg)',
                    padding: '1rem', // Condensed padding
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1rem' // Condensed margin
                }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📍 {t('search_venue') || 'Search for a Venue'}
                    </h3>



                    {/* Venue Search */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                            {t('form_location_label')}
                            {formData.city && (
                                <span style={{
                                    color: 'var(--primary)',
                                    fontWeight: 'bold',
                                    fontSize: '0.95rem',
                                    marginLeft: '8px',
                                    marginRight: '8px'
                                }}>
                                    ({t('in_my_city') || 'In'} {formData.city} 📍)
                                </span>
                            )}
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
                            {t('location_helper_text') || 'Search for restaurants, cafes, or venues near you'}
                        </small>
                    </div>
                </div>

                {/* 2. Media Selection - SECOND STEP */}
                <div style={{
                    background: 'var(--card-bg)',
                    padding: '1rem', // Condensed padding
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1rem' // Condensed margin
                }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎬 {t('form_media_label') || t('form_image_label')}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {t('media_helper_text') || 'Choose a photo or video for your invitation'}
                    </p>
                    <MediaSelector
                        restaurant={restaurantData || prefilledData}
                        suggestedImages={suggestedImages}
                        onMediaSelect={setMediaData}
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
                                <span>{t('processing')}</span>
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

                {/* 3. Invitation Title */}
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
                            <option value="Bar">Bar</option>
                            <option value="Night Club">Night Club</option>
                            <option value="BBQ">BBQ</option>
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
                            min={formData.minDate ? new Date(formData.minDate.seconds ? formData.minDate.toDate() : formData.minDate).toISOString().split('T')[0] : today}
                            max={formData.maxDate ? new Date(formData.maxDate.seconds ? formData.maxDate.toDate() : formData.maxDate).toISOString().split('T')[0] : undefined}
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
                                color: 'var(--text-main)',
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
                                color: 'var(--text-main)',
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
                                color: 'var(--text-main)',
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
                {/* Age Groups Preference (Multi-Select) */}
                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaBirthdayCake />
                        </span>
                        {t('age_range_preference')}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[
                            { value: '18-24', label: '18-24' },
                            { value: '25-34', label: '25-34' },
                            { value: '35-44', label: '35-44' },
                            { value: '45-54', label: '45-54' },
                            { value: '55+', label: '55+' },
                            { value: 'any', label: t('any') }
                        ].map((option) => {
                            // Check if selected
                            const isAny = formData.ageGroups?.includes('any') || !formData.ageGroups || formData.ageGroups.length === 0;
                            const isSelected = option.value === 'any' ? isAny : formData.ageGroups?.includes(option.value);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        let newGroups = formData.ageGroups || [];

                                        if (option.value === 'any') {
                                            // Ensure 'any' is exclusive or just clears others?
                                            // Ideally, if 'any' is clicked, clear specific groups and set 'any'
                                            newGroups = ['any'];
                                        } else {
                                            // If a specific group is clicked
                                            // Remove 'any' first
                                            if (newGroups.includes('any')) newGroups = [];

                                            if (newGroups.includes(option.value)) {
                                                // Deselect
                                                newGroups = newGroups.filter(g => g !== option.value);
                                            } else {
                                                // Select
                                                newGroups = [...newGroups, option.value];
                                            }

                                            // If nothing selected, default back to 'any'
                                            if (newGroups.length === 0) newGroups = ['any'];
                                        }

                                        setFormData({ ...formData, ageGroups: newGroups });
                                    }}
                                    style={{
                                        padding: '14px 12px',
                                        borderRadius: '12px',
                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s',
                                        gridColumn: option.value === 'any' ? 'span 3' : 'span 1',
                                        // Make '55+' span 2 to fit nicely in 3-column grid? No, 5 items + any = 6 items. 
                                        // 18-24, 25-34, 35-44 (Row 1)
                                        // 45-54, 55+, Any (Row 2)? "Any" spanning 1? Or make "Any" span 3 at bottom?
                                        // Let's standard grid:
                                        // Row 1: 18-24, 25-34, 35-44
                                        // Row 2: 45-54, 55+, (Empty)
                                        // Row 3: Any (Span 3)
                                        // Let's force Any to span 3.
                                        minHeight: '70px'
                                    }}
                                >
                                    <HiUser style={{
                                        fontSize: '1.6rem',
                                        color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                        marginBottom: '4px'
                                    }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
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
                                    color: 'var(--text-main)',
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
                    {
                        formData.privacy === 'private' && (
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
                        )
                    }
                </div >

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
                    {isSubmitting ? t('loading') : (t('preview_invitation') || '📋 Preview Invitation')}
                </button>
            </form >
        </div >
    );
};

export default CreateInvitation;
