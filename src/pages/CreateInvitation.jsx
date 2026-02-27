import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaImage, FaTimes, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaBirthdayCake, FaMoneyBillWave, FaLock, FaGlobe, FaPlus, FaHeart, FaBriefcase, FaCocktail, FaSearch, FaMoon, FaUtensils, FaCoffee, FaGamepad } from 'react-icons/fa';
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
import { doc, getDoc, updateDoc, serverTimestamp, deleteField, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchIpLocation } from '../utils/locationUtils';

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
    const [friendsLoading, setFriendsLoading] = useState(false);

    const [restrictionInfo, setRestrictionInfo] = useState(null); // Cancellation restriction info
    const [suggestedImages, setSuggestedImages] = useState([]); // Suggested venue images

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const prefilledData = location.state?.prefilledData; // From PartnerProfile
    const offerData = location.state?.offerData; // From Special Offer
    const fromRestaurant = location.state?.fromRestaurant || !!restaurantData;
    const editingDraft = location.state?.editingDraft; // Editing draft from preview
    const draftId = location.state?.draftId; // Draft ID to load
    const editingInvitation = location.state?.editingInvitation; // Editing PUBLISHED invitation

    // Normalize legacy invitation data for validation (Safety Check)
    const originalGenderGroups = React.useMemo(() => {
        if (!editingInvitation) return [];
        if (editingInvitation.genderGroups && editingInvitation.genderGroups.length > 0) return editingInvitation.genderGroups;
        // Legacy handling
        if (editingInvitation.genderPreference === 'any' || !editingInvitation.genderPreference) return ['male', 'female', 'unspecified'];
        return [editingInvitation.genderPreference];
    }, [editingInvitation]);

    const originalAgeGroups = React.useMemo(() => {
        if (!editingInvitation) return [];
        if (editingInvitation.ageGroups && editingInvitation.ageGroups.length > 0) return editingInvitation.ageGroups;
        // Legacy handling
        if (!editingInvitation.ageRange || editingInvitation.ageRange === 'any') {
            return ['18-24', '25-34', '35-44', '45-54', '55+'];
        }
        // If specific legacy range, we try to match or default to all to be safe (preventing removal of potentially huge groups)
        // For now, if it's not 'any', we assume it maps to 'all' to prevent accidental restriction, or just let them edit.
        // User specific case: "Defined all ages".
        return ['18-24', '25-34', '35-44', '45-54', '55+'];
    }, [editingInvitation]);


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
        guestsNeeded: 3,
        genderPreference: 'custom',
        genderGroups: [], // Default to NONE selected
        ageRange: 'custom',
        ageGroups: [], // Default to NONE selected
        paymentType: 'Split',
        description: offerData?.description || '',
        image: offerData?.image || restaurantData?.image || prefilledData?.restaurantImage || null,
        // Get coordinates from multiple possible sources
        lat: offerData?.lat || restaurantData?.lat || restaurantData?.coordinates?.lat || prefilledData?.lat,
        lng: offerData?.lng || restaurantData?.lng || restaurantData?.coordinates?.lng || prefilledData?.lng,
        privacy: 'public',

        // Special Offer constraints
        minDate: offerData?.startDate || null,
        maxDate: offerData?.endDate || null,
        lastLocationUpdate: serverTimestamp(),
        occasionType: editingInvitation?.occasionType || 'Social',
        // Override with editingInvitation data if present
        ...(editingInvitation ? {
            ...editingInvitation,
            title: editingInvitation.title,
            description: editingInvitation.description,
            date: editingInvitation.date,
            time: editingInvitation.time,
            guestsNeeded: editingInvitation.guestsNeeded,
            genderGroups: editingInvitation.genderGroups || ['male', 'female', 'unspecified'],
            ageGroups: editingInvitation.ageGroups || ['18-24', '25-34', '35-44', '45-54', '55+'],
            image: editingInvitation.image, // Keep existing image URL
            location: editingInvitation.location,
            lat: editingInvitation.lat,
            lng: editingInvitation.lng,
            city: editingInvitation.city,
            country: editingInvitation.country,
            userLat: editingInvitation.userLat,
            userLng: editingInvitation.userLng,
        } : {})
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

                        });
                    }
                } catch (error) {
                    console.error('Error loading draft:', error);
                }
            }
        };

        loadDraft();
    }, [editingDraft, draftId]);

    // Mutual friend fetching removed (Private-only feature)




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



        // Validate Gender Groups (Must have at least one)
        if (!formData.genderGroups || formData.genderGroups.length === 0) {
            alert(t('please_select_gender_group', { defaultValue: 'Please select at least one gender group' }));
            return;
        }

        // Validate Age Groups (Must have at least one)
        if (!formData.ageGroups || formData.ageGroups.length === 0) {
            alert(t('please_select_age_group', { defaultValue: 'Please select at least one age group' }));
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
        const userId = currentUser?.id || authUser?.uid;
        if (!userId) {
            alert(t('login_required') || 'Authentication required');
            return;
        }

        const validation = await validateInvitationCreation(userId);
        if (!validation.valid) {
            console.log('❌ Daily limit validation failed:', validation.error);
            const confirmMessage = `${validation.error}\n\nDo you want to go to your current invitation?`;

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

                    if (mediaFields.mediaSource === 'restaurant' || mediaFields.mediaSource === 'google_place' || mediaData.source === 'google_place' || mediaData.source === 'venue') {
                        // For updates, use deleteField. For new docs, just exclude them.
                        const isUpdate = (editingDraft && draftId) || editingInvitation;

                        if (isUpdate) {
                            mediaFields.customImage = deleteField();
                            mediaFields.customVideo = deleteField();
                            mediaFields.videoThumbnail = deleteField();
                        } else {
                            // On new doc, we just ensure these aren't in the object if we don't want them
                            delete mediaFields.customImage;
                            delete mediaFields.customVideo;
                            delete mediaFields.videoThumbnail;
                        }
                        mediaFields.mediaType = 'image';
                    }

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
                alert(t('failed_create_invitation') || 'Failed to create invitation. Please try again.');
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
        console.log('🚀 Publishing invitation directly/updating...');

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



        // Check for cancellation restrictions
        if (restrictionInfo && !restrictionInfo.canCreate) {
            alert(t('cannot_create_restricted', {
                date: restrictionInfo.until?.toLocaleDateString()
            }));
            return;
        }

        // Check daily invitation limit (only if creating new)
        if (!editingInvitation) {
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
        }

        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            let finalImageUrl = formData.image;
            let mediaFields = {};

            // 1. Process New Media from MediaSelector (Prioritized)
            if (mediaData) {
                console.log('📤 Processing media from MediaSelector...');
                setUploadProgress(20);

                try {
                    const userId = currentUser?.id || authUser?.uid;
                    if (!userId) throw new Error('User ID missing');

                    mediaFields = await processInvitationMedia(mediaData, userId);
                    console.log('✅ Media processed successfully:', mediaFields);

                    if (mediaFields.mediaSource === 'restaurant' || mediaFields.mediaSource === 'google_place' || mediaData.source === 'google_place' || mediaData.source === 'venue') {
                        if (editingInvitation) {
                            mediaFields.customImage = deleteField();
                            mediaFields.customVideo = deleteField();
                            mediaFields.videoThumbnail = deleteField();
                        } else {
                            delete mediaFields.customImage;
                            delete mediaFields.customVideo;
                            delete mediaFields.videoThumbnail;
                        }
                        mediaFields.mediaType = 'image';
                    }

                    if (mediaFields.restaurantImage) {
                        finalImageUrl = mediaFields.restaurantImage;
                    }
                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    alert(t('media_upload_failed') || 'Failed to upload media');
                    setIsSubmitting(false);
                    return;
                }
                setUploadProgress(80);
            }
            // 2. Fallback: Legacy Image Upload (if imageFile exists and no mediaData)
            else if (imageFile) {
                console.log('📤 Uploading image (Legacy)...');
                const invitationId = editingInvitation ? editingInvitation.id : `temp_${Date.now()}`;
                const url = await uploadInvitationPhoto(
                    imageFile,
                    invitationId,
                    0,
                    (progress) => setUploadProgress(progress)
                );
                finalImageUrl = url;
                console.log('✅ Image uploaded:', url);

                // Construct legacy media fields
                mediaFields = {
                    mediaSource: 'custom',
                    restaurantImage: url,
                    mediaType: 'image'
                };
            }

            const cleanData = {
                ...formData,
                ...mediaFields, // Merge new media fields
                image: finalImageUrl, // Ensure backward compatibility for views using 'image'
                isFollowersOnly: formData.privacy === 'followers'
            };

            // Remove purely UI fields if strictly necessary, but Firestore ignores undefined usually.
            // If mediaFields provided a video, ensure we don't accidentally keep old image as primary if unnecessary
            if (mediaFields.mediaType === 'video') {
                // If video, maybe clear image field if it was a photo? 
                // But usually we need a thumbnail. processInvitationMedia returns thumbnail in restaurantImage or similar? 
                // Let's rely on mediaFields return values.
            }

            if (editingInvitation) {
                console.log('📝 Updating invitation:', editingInvitation.id);
                const invitationRef = doc(db, 'invitations', editingInvitation.id);

                await updateDoc(invitationRef, cleanData);
                console.log('✅ Invitation updated');
                alert(t('invitation_updated', { defaultValue: 'Invitation updated successfully' }));
                navigate(`/invitation/${editingInvitation.id}`);
            } else {
                // This path is usually handled by handlePreview -> Draft -> Publish, but logic remains
                console.log('📝 Creating invitation via direct submit...');
                const newId = await addInvitation(cleanData);
                if (newId) {
                    navigate(`/invitation/${newId}`);
                }
            }
        } catch (error) {
            console.error('❌ Error creating/updating invitation:', error);
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

        const fetchLocation = async () => {
            const data = await fetchIpLocation();
            if (data.success) {
                console.log('✅ IP Location found:', data.city, data.country_code);
                setFormData(prev => ({
                    ...prev,
                    city: data.city,
                    country: data.country_code,
                    userLat: data.latitude,
                    userLng: data.longitude
                }));
            }
        };

        if (!restaurantData) {
            // 1. Try Profile First
            const profileFound = setLocationFromProfile();

            // 2. If no profile location, use IP Fallback
            if (!profileFound) {
                fetchLocation();
            }
        }
    }, [userProfile, restaurantData]);

    // Restore Google Images when editing (Address User Issue: Images missing in Edit Mode)
    useEffect(() => {
        const restoreImages = () => {
            if (editingInvitation &&
                (!suggestedImages || suggestedImages.length === 0) &&
                !fromRestaurant &&
                window.google &&
                window.google.maps &&
                window.google.maps.places) {

                // Use location name for search
                const queryName = editingInvitation.location || editingInvitation.restaurantName;
                if (!queryName) return;

                const searchQuery = queryName + (editingInvitation.city ? ` ${editingInvitation.city}` : '');
                console.log('🔄 Restoring Google Images for:', searchQuery);

                try {
                    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                    const request = {
                        query: searchQuery,
                        fields: ['place_id'] // Fetch ID first
                    };

                    service.findPlaceFromQuery(request, (results, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                            const placeId = results[0].place_id;

                            // Get full details to ensure we get ALL photos
                            service.getDetails({
                                placeId: placeId,
                                fields: ['photos']
                            }, (placeDetails, detailStatus) => {
                                if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK && placeDetails.photos) {
                                    const urls = placeDetails.photos.slice(0, 5).map(p => p.getUrl({ maxWidth: 800 }));
                                    console.log('✅ Successfully restored', urls.length, 'images via getDetails');
                                    setSuggestedImages(urls);
                                } else {
                                    console.log('⚠️ Place found but getDetails returned no photos');
                                }
                            });
                        } else {
                            console.log('⚠️ Could not find place to restore images:', status);
                        }
                    });
                } catch (err) {
                    console.error('❌ Error restoring images:', err);
                }
            }
        };

        // Attempt restore after short delay to ensure Google API loaded
        const timer = setTimeout(restoreImages, 1000);
        return () => clearTimeout(timer);
    }, [editingInvitation, fromRestaurant]);

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
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '900' }}>
                {editingInvitation ? t('edit_invitation', { defaultValue: 'Edit Invitation' }) : t('create_invitation_title')}
            </h2>

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

            {/* Show Locked Venue when Editing (Title/Location cannot change) */}
            {editingInvitation && (
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
                    <FaMapMarkerAlt style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_location') || 'Venue Location'}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            {formData.restaurantName || formData.location || formData.title}
                        </div>
                        {formData.city && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {formData.city}
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                        <FaLock />
                    </div>
                </div>
            )}

            <form onSubmit={editingInvitation ? handleSubmit : handlePreview} className="create-form">

                {/* 1. Location Search - FIRST STEP - Hidden when editing */}
                {!editingInvitation && (
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
                )}

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
                        disabled={!!editingInvitation}
                        style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}}
                    />
                </div>

                {/* 4. Message Area (Moved from bottom) */}
                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label>{t('form_message_label', 'Message')}</label>
                        <span style={{ fontSize: '0.75rem', color: (formData.description?.length || 0) > 180 ? '#f87171' : 'var(--text-muted)' }}>
                            {(formData.description?.length || 0)}/200
                        </span>
                    </div>
                    <textarea
                        name="description"
                        rows="4"
                        placeholder={t('form_message_placeholder', 'Write your message to the invitees here...')}
                        value={formData.description}
                        onChange={handleChange}
                        className="input-field text-area"
                        maxLength="200"
                    ></textarea>
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
                        </select>
                    </div>
                </div>

                {/* 5. Invitation Mood / Occasion Type Selection - For Card Design */}
                <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="elegant-label">
                        <span className="label-icon"><FaPlus /></span>
                        {t('invitation_occasion_type', 'Invitation Mood (Card Design)')}
                    </label>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px',
                        marginTop: '0.5rem'
                    }}>
                        {[
                            { value: 'Dating', label: t('occasion_dating'), icon: FaHeart, color: '#f43f5e' },
                            { value: 'Birthday', label: t('occasion_birthday'), icon: FaBirthdayCake, color: '#fb923c' },
                            { value: 'Social', label: t('occasion_social'), icon: FaUsers, color: '#22c55e' },
                            { value: 'Work', label: t('occasion_work'), icon: FaBriefcase, color: '#8b5cf6' },
                            { value: 'Nightlife', label: t('occasion_nightlife'), icon: FaMoon, color: '#eab308' },
                            { value: 'Dining', label: t('occasion_dining'), icon: FaUtensils, color: '#3b82f6' },
                            { value: 'Café', label: t('occasion_cafe'), icon: FaCoffee, color: '#d97706' },
                            { value: 'Gaming', label: t('occasion_gaming'), icon: FaGamepad, color: '#6366f1' }
                        ].map((option) => {
                            const isSelected = formData.occasionType === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, occasionType: option.value })}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        padding: '16px 10px',
                                        borderRadius: '16px',
                                        border: isSelected ? `2px solid ${option.color}` : '1px solid var(--border-color)',
                                        background: isSelected ? `${option.color}15` : 'var(--bg-input)',
                                        color: isSelected ? option.color : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        transform: isSelected ? 'translateY(-2px)' : 'none',
                                        boxShadow: isSelected ? `0 4px 15px ${option.color}20` : 'none'
                                    }}
                                >
                                    <option.icon style={{ fontSize: '1.4rem' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>{option.label}</span>
                                </button>
                            );
                        })}
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
                            disabled={!!editingInvitation} // Lock Date
                            className="input-field"
                            style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}}
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
                            disabled={!!editingInvitation} // Lock Time
                            className="input-field"
                            style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaUserFriends />
                        </span>
                        {t('guests_needed')}
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

                {/* Gender Groups Preference */}
                <div className="form-group">
                    <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <span className="label-icon"><FaVenusMars /></span>
                            {t('guest_gender_preference')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {t('multi_select', { defaultValue: '(Select multiple)' })}
                        </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        {[
                            { value: 'male', label: t('male'), icon: IoMale },
                            { value: 'female', label: t('female'), icon: IoFemale },
                            { value: 'unspecified', label: t('non_binary', { defaultValue: 'Non-Binary' }), icon: IoMaleFemale }
                        ].map((option) => {
                            const currentGroups = formData.genderGroups || [];
                            const isSelected = currentGroups.includes(option.value);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        let newGroups = [...currentGroups];
                                        if (isSelected) {
                                            // PREVENT REMOVAL if it was in the original invitation (Normalized)
                                            if (originalGenderGroups.includes(option.value)) {
                                                alert(t('cannot_remove_gender_group', { defaultValue: 'Cannot remove a previously selected group. You can only add more.' }));
                                                return;
                                            }
                                            newGroups = newGroups.filter(g => g !== option.value);
                                        } else {
                                            newGroups.push(option.value);
                                        }
                                        setFormData({ ...formData, genderGroups: newGroups, genderPreference: 'custom' });
                                    }}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 12px',
                                        borderRadius: '16px',
                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--hover-overlay)',
                                        color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isSelected ? 'translateY(-2px)' : 'none',
                                        boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                                    }}
                                >
                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary)', fontSize: '0.8rem' }}>
                                            <FaCheckCircle />
                                        </div>
                                    )}
                                    <option.icon style={{ fontSize: '2rem', color: isSelected ? 'var(--primary)' : 'inherit', filter: isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : 'none' }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '800' : '600' }}>
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {(!formData.genderGroups || formData.genderGroups.length === 0) && (
                        <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px', textAlign: 'center', background: 'rgba(248, 113, 113, 0.1)', padding: '4px', borderRadius: '8px' }}>
                            ⚠️ {t('select_at_least_one_gender', { defaultValue: 'Please select at least one option' })}
                        </p>
                    )}
                </div>

                {/* Age Groups Preference */}
                <div className="form-group">
                    <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <span className="label-icon"><FaBirthdayCake /></span>
                            {t('age_range_preference')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {t('multi_select', { defaultValue: '(Select multiple)' })}
                        </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {[
                            { value: '18-24', label: '18-24' },
                            { value: '25-34', label: '25-34' },
                            { value: '35-44', label: '35-44' },
                            { value: '45-54', label: '45-54' },
                            { value: '55+', label: '55+' },
                            // Removed 'Any' option as requested
                        ].map((option) => {
                            const currentGroups = formData.ageGroups || [];
                            const isSelected = currentGroups.includes(option.value);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        let newGroups = [...currentGroups];
                                        if (isSelected) {
                                            // PREVENT REMOVAL if it was in the original invitation (Normalized)
                                            if (originalAgeGroups.includes(option.value)) {
                                                alert(t('cannot_remove_age_group', { defaultValue: 'Cannot remove a previously selected age group. You can only add more.' }));
                                                return;
                                            }
                                            newGroups = newGroups.filter(g => g !== option.value);
                                        } else {
                                            newGroups.push(option.value);
                                        }
                                        // If ageGroups is modified, we set ageRange to 'custom' to avoid legacy logic taking over
                                        setFormData({ ...formData, ageGroups: newGroups, ageRange: 'custom' });
                                    }}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 12px',
                                        borderRadius: '16px',
                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--hover-overlay)',
                                        color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        opacity: 1, // Full opacity for clear visibility
                                        minHeight: '80px',
                                        transform: isSelected ? 'translateY(-2px)' : 'none',
                                        boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                                    }}
                                >
                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: '6px', right: '6px', color: 'var(--primary)', fontSize: '0.7rem' }}>
                                            <FaCheckCircle />
                                        </div>
                                    )}
                                    <HiUser style={{
                                        fontSize: '1.8rem',
                                        color: isSelected ? 'var(--primary)' : 'inherit',
                                        marginBottom: '4px',
                                        filter: isSelected ? 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.5))' : 'none'
                                    }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '800' : '600' }}>
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {(!formData.ageGroups || formData.ageGroups.length === 0) && (
                        <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px', textAlign: 'center', background: 'rgba(248, 113, 113, 0.1)', padding: '4px', borderRadius: '8px' }}>
                            ⚠️ {t('select_at_least_one_age', { defaultValue: 'Please select at least one age group' })}
                        </p>
                    )}
                </div>

                {/* Privacy Settings */}
                <div className="form-group" style={{ marginTop: '1.5rem', background: 'var(--hover-overlay)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem' }}>
                        <span className="label-icon"><FaLock /></span>
                        {t('privacy_settings') || 'Privacy Settings'}
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {['public', 'followers'].map(mode => (
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

                                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                    {mode === 'public' ? (t('public') || 'Public') : (t('followers_only') || 'Followers')}
                                </span>
                            </button>
                        ))}
                    </div>
                </div >




                <button type="submit" className="btn btn-primary btn-block" style={{ height: '60px', marginTop: '1rem', fontSize: '1.1rem' }} disabled={isSubmitting}>
                    {isSubmitting ? t('loading') : (editingInvitation ? (t('save_changes') || '💾 Save Changes') : (t('preview_invitation') || '📋 Preview Invitation'))}
                </button>
            </form >
        </div >
    );
};

export default CreateInvitation;
