import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaMoneyBillWave, FaEdit, FaHeart, FaUsers, FaBriefcase, FaSmile,
    FaBirthdayCake, FaMoon, FaUtensils, FaCoffee, FaGamepad
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import MediaSelector from '../components/Invitations/MediaSelector';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { processInvitationMedia } from '../services/mediaService';
import { getMutualFollowers } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { fetchIpLocation } from '../utils/locationUtils';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';
import './PrivateInvitation.css';

const CreatePrivateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addPrivateInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth();

    const quotaInfo = canCreatePrivateInvitation();

    // UI State
    const [mediaData, setMediaData] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mutualFriends, setMutualFriends] = useState([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [suggestedImages, setSuggestedImages] = useState([]); // Venue images from Google
    const [suggestedImagesLoading, setSuggestedImagesLoading] = useState(false);
    const [existingDraftId, setExistingDraftId] = useState(null);

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const editInvitation = location.state?.editInvitation;

    const [formData, setFormData] = useState({
        title: restaurantData ? `${t('dinner_at')} ${restaurantData.name}` : '',
        restaurantId: restaurantData?.id || null,
        restaurantName: restaurantData?.name || '',
        city: restaurantData?.city || '',
        date: '',
        time: '',
        location: restaurantData?.address || restaurantData?.location || '',
        paymentType: 'Split',
        description: '',
        privacy: 'private',
        invitedFriends: [],
        country: restaurantData?.country || '',
        lat: restaurantData?.lat || restaurantData?.coordinates?.lat,
        lng: restaurantData?.lng || restaurantData?.coordinates?.lng,
        userLat: null,
        userLng: null,
        occasionType: editInvitation?.occasionType || 'social',
    });

    // Populate data when editing
    useEffect(() => {
        if (editInvitation) {
            console.log('📝 Editing existing invitation:', editInvitation);
            setExistingDraftId(editInvitation.id);
            setFormData({
                title: editInvitation.title || '',
                restaurantId: editInvitation.restaurantId || null,
                restaurantName: editInvitation.restaurantName || '',
                city: editInvitation.city || '',
                date: editInvitation.date || '',
                time: editInvitation.time || '',
                location: editInvitation.location || '',
                paymentType: editInvitation.paymentType || 'Split',
                description: editInvitation.description || '',
                privacy: 'private',
                invitedFriends: editInvitation.invitedFriends || [],
                country: editInvitation.country || '',
                lat: editInvitation.lat || null,
                lng: editInvitation.lng || null,
                userLat: editInvitation.userLat || null,
                userLng: editInvitation.userLng || null,
                occasionType: editInvitation.occasionType || 'social'
            });

            if (editInvitation.customImage || editInvitation.image) {
                setMediaData({
                    type: 'image',
                    url: editInvitation.customImage || editInvitation.image,
                    isCustom: !!editInvitation.customImage
                });
            }
        }
    }, [editInvitation]);

    // Redirect guests
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            navigate('/login');
        }
    }, [userProfile, currentUser, navigate]);

    // Fetch Mutual Followers for Selection
    useEffect(() => {
        const fetchFriends = async () => {
            const userId = authUser?.uid || currentUser?.id;
            if (!userId || userId === 'guest') return;

            setFriendsLoading(true);
            try {
                let followingIds = userProfile?.following || [];
                if (followingIds.length === 0) {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    followingIds = userDoc.data()?.following || [];
                }
                const friends = await getMutualFollowers(userId, followingIds);
                setMutualFriends(friends);
            } catch (error) {
                console.error('Error fetching friends:', error);
            } finally {
                setFriendsLoading(false);
            }
        };
        fetchFriends();
    }, [authUser, currentUser, userProfile]);

    // Real-time location detection: GPS first → profile fallback → IP last resort
    useEffect(() => {
        if (restaurantData) return;

        const detectLocation = async () => {
            // STEP 1: Live GPS → real city
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 6000,
                            maximumAge: 0
                        })
                    );
                    const { latitude, longitude } = pos.coords;
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    if (res.ok) {
                        const d = await res.json();
                        const city = d.city || d.locality || d.principalSubdivision || '';
                        if (city) {
                            setFormData(prev => ({
                                ...prev,
                                city,
                                country: d.countryCode || prev.country,
                                userLat: latitude,
                                userLng: longitude
                            }));
                            return;
                        }
                    }
                } catch { /* GPS denied or failed */ }
            }

            // STEP 2: Profile city fallback
            if (userProfile?.city) {
                setFormData(prev => ({
                    ...prev,
                    city: userProfile.city,
                    country: userProfile.countryCode || prev.country || '',
                    userLat: userProfile.coordinates?.lat || prev.userLat,
                    userLng: userProfile.coordinates?.lng || prev.userLng,
                }));
                return;
            }

            // STEP 3: IP last resort
            const data = await fetchIpLocation();
            if (data.success) {
                setFormData(prev => ({
                    ...prev,
                    city: data.city,
                    country: data.country_code,
                    userLat: data.latitude,
                    userLng: data.longitude
                }));
            }
        };

        detectLocation();
    }, [restaurantData]);

    const handleLocationSelect = (placeData) => {
        setFormData(prev => ({
            ...prev,
            location: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title
        }));

        if (placeData.photos && placeData.photos.length > 0) {
            setSuggestedImages(placeData.photos);
        }
    };

    const filteredFriends = mutualFriends.filter(friend =>
        friend.display_name?.toLowerCase().includes(friendSearchQuery.toLowerCase())
    );

    // Max guests based on occasion type
    const getMaxGuests = (occasionType) => {
        if (!occasionType) return 30;
        const lower = occasionType.toLowerCase();
        if (lower === 'dating') return 1;
        return 30;
    };

    const maxGuests = getMaxGuests(formData.occasionType);
    const isAtLimit = (formData.invitedFriends || []).length >= maxGuests;

    // Auto-trim invited friends when occasion type changes (e.g. switching to Dating)
    useEffect(() => {
        const limit = getMaxGuests(formData.occasionType);
        if ((formData.invitedFriends || []).length > limit) {
            setFormData(prev => ({
                ...prev,
                invitedFriends: prev.invitedFriends.slice(0, limit)
            }));
        }
    }, [formData.occasionType]);

    const toggleFriendSelection = (friendId) => {
        setFormData(prev => {
            const current = prev.invitedFriends || [];
            if (current.includes(friendId)) {
                // Always allow deselection
                return { ...prev, invitedFriends: current.filter(id => id !== friendId) };
            } else {
                // Block adding if at limit
                if (current.length >= getMaxGuests(prev.occasionType)) return prev;
                return { ...prev, invitedFriends: [...current, friendId] };
            }
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePreview = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.date || !formData.time || !formData.location.trim()) {
            showToast(t('please_fill_required_fields') || 'Please fill in all required fields', 'error');
            return;
        }

        if (formData.invitedFriends.length === 0) {
            showToast(t('please_invite_at_least_one_guest') || 'Please invite at least one guest for a private invitation', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            let mediaFields = {};
            if (mediaData) {
                try {
                    const userId = currentUser?.id || authUser?.uid;
                    mediaFields = await processInvitationMedia(mediaData, userId);
                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    showToast(t('media_upload_failed') || 'Failed to upload media. Try again.', 'error');
                    return;
                }
            }

            // Initialize RSVPs as 'pending' for all invited friends
            const initialRsvps = {};
            formData.invitedFriends.forEach(friendId => {
                initialRsvps[friendId] = 'pending';
            });

            const draftData = {
                ...formData,
                ...mediaFields,
                rsvps: initialRsvps,
                type: 'Private',
                status: 'draft',
                createdAt: serverTimestamp()
            };

            if (existingDraftId) {
                // UPDATE EXISTING
                const draftRef = doc(db, 'private_invitations', existingDraftId);
                await updateDoc(draftRef, {
                    ...draftData,
                    updatedAt: serverTimestamp()
                });
                navigate(`/invitation/private/preview/${existingDraftId}`);
            } else {
                // CREATE NEW
                console.log('🔏 Creating private invitation draft...');
                const draftId = await addPrivateInvitation(draftData);
                console.log('📋 Draft result:', draftId);
                if (draftId) {
                    navigate(`/invitation/private/preview/${draftId}`);
                }
            }
        } catch (error) {
            console.error('Error creating private draft:', error);
            showToast(t('failed_create_invitation'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Restore Google Images when editing (wait for Maps script before using)
    useEffect(() => {
        if (!formData.location || suggestedImages?.length > 0 || formData.restaurantId) return;

        let cancelled = false;
        const searchQuery = formData.location + (formData.city ? ` ${formData.city}` : '');
        setSuggestedImagesLoading(true);

        loadGoogleMapsScript()
            .then(() => {
                if (cancelled || typeof window === 'undefined' || !window.google?.maps?.places) {
                    if (!cancelled) setSuggestedImagesLoading(false);
                    return;
                }

                try {
                    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                    service.findPlaceFromQuery({ query: searchQuery, fields: ['place_id'] }, (results, status) => {
                        if (cancelled) return;
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
                            service.getDetails({ placeId: results[0].place_id, fields: ['photos'] }, (details, dStatus) => {
                                if (cancelled) return;
                                setSuggestedImagesLoading(false);
                                if (dStatus === window.google.maps.places.PlacesServiceStatus.OK && details?.photos) {
                                    const urls = details.photos.slice(0, 5).map(p => p.getUrl({ maxWidth: 800 }));
                                    setSuggestedImages(urls);
                                }
                            });
                        } else {
                            setSuggestedImagesLoading(false);
                        }
                    });
                } catch (err) {
                    if (!cancelled) {
                        console.error('❌ Photo restore error:', err);
                        setSuggestedImagesLoading(false);
                    }
                }
            })
            .catch(() => setSuggestedImagesLoading(false));

        return () => {
            cancelled = true;
            setSuggestedImagesLoading(false);
        };
    }, [formData.location]);

    if (!quotaInfo.canCreate && !editInvitation) {
        const isDesktop = window.innerWidth >= 1024;
        return (
            <div className="private-create-wrapper private-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px' }}>
                <div className="ui-card ui-card--lg" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '30px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔐</div>
                    <h2 className="ui-prompt__title" style={{ fontSize: '1.6rem', color: 'var(--luxury-gold)', marginBottom: '12px' }}>
                        {t('insufficient_credits')}
                    </h2>
                    <p className="ui-prompt__desc" style={{ marginBottom: '25px' }}>
                        {t('insufficient_credits_desc')}
                    </p>
                    <button
                        onClick={() => navigate(isDesktop ? '/pricing' : '/pricing')}
                        className="ui-btn ui-btn--primary"
                        style={{ width: '100%', marginBottom: '12px' }}
                    >
                        {t('upgrade_now')}
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="ui-btn ui-btn--ghost"
                        style={{ width: '100%' }}
                    >
                        {t('go_back')}
                    </button>
                </div>
            </div>
        );
    }

    // Quota display helpers
    const quota = quotaInfo.quota;
    const isUnlimited = quota === 'unlimited' || quota === '∞' || quota === -1;
    const usedThisWeek = userProfile?.usedPrivateCreditsThisWeek || 0;
    const weeklyLimit = userProfile?.weeklyPrivateQuota || 0;

    return (
        <div className="private-create-wrapper private-theme">
            <div className="private-header-premium">
                <button onClick={() => navigate(-1)} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge">
                    {t('private_invitation_badge', 'Private & Exclusive Invitation')}
                </div>
                <h2 className="private-header-title">
                    <FaLock />
                    {t('create_private_invitation', 'Create Private Invitation')}
                </h2>
                <p className="private-header-desc">
                    {t('private_invitation_desc', 'This invitation will not be visible to the public. Only people you invite can see and join.')}
                </p>

                {/* Quota Banner */}
                <div style={{
                    margin: '12px 0 0',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: isUnlimited
                        ? 'rgba(72,187,120,0.1)'
                        : quota <= 1
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(139,92,246,0.1)',
                    border: `1px solid ${isUnlimited ? 'rgba(72,187,120,0.3)' : quota <= 1 ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.875rem',
                    color: isUnlimited ? '#4ade80' : quota <= 1 ? '#f87171' : '#a78bfa',
                    fontWeight: 600
                }}>
                    <span>{isUnlimited ? '∞' : `${quota}`}</span>
                    <span style={{ opacity: 0.8, fontWeight: 400 }}>
                        {isUnlimited
                            ? 'Unlimited private invitations'
                            : `private invitation${quota !== 1 ? 's' : ''} remaining this ${quotaInfo.period || 'month'}`}
                    </span>
                    {!isUnlimited && (userProfile?.weeklyPrivateQuota > 0 || userProfile?.monthlyPrivateQuota > 0) && (
                        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>
                            {quotaInfo.period === 'month'
                                ? `${userProfile?.usedPrivateCreditsThisMonth || 0}/${userProfile?.monthlyPrivateQuota} used this month`
                                : `${userProfile?.usedPrivateCreditsThisWeek || 0}/${userProfile?.weeklyPrivateQuota} used this week`}
                        </span>
                    )}
                </div>
            </div>

            <div className="private-form-container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={handlePreview} className="elegant-form">
                    {/* Basic Info */}
                    <div className="form-group mb-4">
                        <label className="elegant-label">{t('invitation_title')}</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder={t('enter_title')}
                            className="elegant-input"
                            required
                        />
                    </div>

                    <div className="form-row mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="form-group">
                            <label className="elegant-label"><FaCalendarAlt /> {t('date')}</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="elegant-input"
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="elegant-label"><FaClock /> {t('time')}</label>
                            <input
                                type="time"
                                name="time"
                                value={formData.time}
                                onChange={handleChange}
                                className="elegant-input"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group mb-4">
                        <label className="elegant-label">{t('form_occasion_label')}</label>
                        <div className="occasion-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {[
                                { id: 'dating', icon: <FaHeart />, label: 'Dating' },
                                { id: 'birthday', icon: <FaBirthdayCake />, label: 'Birthday' },
                                { id: 'social', icon: <FaUsers />, label: 'Social' },
                                { id: 'work', icon: <FaBriefcase />, label: 'Work' },
                                { id: 'nightlife', icon: <FaMoon />, label: 'Nightlife' },
                                { id: 'dining', icon: <FaUtensils />, label: 'Dining' },
                                { id: 'cafe', icon: <FaCoffee />, label: 'Café' },
                                { id: 'gaming', icon: <FaGamepad />, label: 'Gaming' }
                            ].map(occ => (
                                <div
                                    key={occ.id}
                                    onClick={() => setFormData(prev => ({ ...prev, occasionType: occ.label }))}
                                    style={{
                                        padding: '15px 10px',
                                        borderRadius: '16px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        borderColor: formData.occasionType === occ.label ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                        background: formData.occasionType === occ.label ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                                        color: formData.occasionType === occ.label ? 'var(--primary)' : 'var(--text-muted)',
                                        transition: 'all 0.3s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.65rem',
                                        fontWeight: '800'
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem', color: formData.occasionType === occ.label ? 'var(--luxury-gold)' : 'inherit' }}>
                                        {occ.icon}
                                    </span>
                                    {t(`occasion_${occ.id}`)}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-group mb-4">
                        <label className="elegant-label"><FaMapMarkerAlt className="label-icon" /> {t('location')}</label>
                        <LocationAutocomplete
                            value={formData.location}
                            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                            onSelect={handleLocationSelect}
                            city={formData.city}
                            countryCode={formData.country}
                            userLat={formData.userLat}
                            userLng={formData.userLng}
                            className="elegant-input"
                        />
                    </div>

                    {/* Media Selector */}
                    <div className="form-group mb-4">
                        <label className="elegant-label">{t('invitation_media')}</label>
                        <MediaSelector
                            restaurant={{
                                restaurantImage: formData.restaurantImage || formData.image,
                                name: formData.restaurantName
                            }}
                            suggestedImages={suggestedImages}
                            suggestedImagesLoading={suggestedImagesLoading}
                            onMediaSelect={(data) => setMediaData(data)}
                            initialData={mediaData}
                        />
                    </div>

                    {/* Payment Type */}
                    <div className="form-group mb-4">
                        <label className="elegant-label"><FaMoneyBillWave /> {t('payment_type')}</label>
                        <div className="payment-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {['Split', 'Host Pays'].map(type => (
                                <div
                                    key={type}
                                    onClick={() => setFormData(prev => ({ ...prev, paymentType: type }))}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        borderColor: formData.paymentType === type ? 'var(--primary)' : 'var(--border-color)',
                                        background: formData.paymentType === type ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                                        color: formData.paymentType === type ? 'var(--primary)' : 'var(--text-main)',
                                        fontWeight: '700',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {t(type.toLowerCase().replace(' ', '_'))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group mb-4">
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {t('message_to_friends')}
                            <span style={{ fontSize: '0.75rem', color: (formData.description?.length || 0) > 180 ? '#f87171' : 'var(--text-muted)' }}>
                                {(formData.description?.length || 0)}/200
                            </span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder={t('write_something_personal')}
                            className="elegant-textarea"
                            rows="3"
                            maxLength="200"
                        ></textarea>
                    </div>

                    {/* Friend Selection — Grid Layout */}
                    <div className="form-group mb-4" style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span><FaUserFriends /> {t('invite_friends')}</span>
                            <span style={{
                                color: isAtLimit ? '#f87171' : 'var(--primary)',
                                fontSize: '0.8rem',
                                fontWeight: 700
                            }}>
                                {formData.invitedFriends.length}/{maxGuests}
                                {isAtLimit && ' 🔒'}
                            </span>
                        </label>
                        {isAtLimit && (
                            <div style={{
                                marginBottom: 10,
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: maxGuests === 1 ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.08)',
                                border: `1px solid ${maxGuests === 1 ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                color: maxGuests === 1 ? '#fbbf24' : '#f87171',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                {maxGuests === 1
                                    ? '💑 ' + t('dating_one_guest_only', 'Private date — only 1 guest allowed')
                                    : '⛔ ' + t('max_guests_reached', `Maximum of ${maxGuests} guests reached`)}
                            </div>
                        )}

                        {/* Search bar */}
                        <div style={{ position: 'relative', marginBottom: 12 }}>
                            <input
                                type="text"
                                placeholder={t('search_friends')}
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            />
                            <FaSearch style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        </div>

                        {/* Friend grid */}
                        {friendsLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>{t('loading')}</div>
                        ) : filteredFriends.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, maxHeight: 240, overflowY: 'auto', padding: '4px 2px' }}>
                                {filteredFriends.map(friend => {
                                    const isSelected = formData.invitedFriends.includes(friend.id);
                                    const isDisabled = !isSelected && isAtLimit;
                                    return (
                                        <div
                                            key={friend.id}
                                            onClick={() => !isDisabled && toggleFriendSelection(friend.id)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '10px 6px',
                                                borderRadius: 12,
                                                background: isSelected ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1.5px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.07)'}`,
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isDisabled ? 0.4 : 1,
                                                transition: 'all 0.18s',
                                                position: 'relative'
                                            }}
                                        >
                                            {isSelected && (
                                                <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <FaCheckCircle style={{ color: 'white', fontSize: '0.6rem' }} />
                                                </div>
                                            )}
                                            <img
                                                src={getSafeAvatar(friend)}
                                                alt={friend.display_name}
                                                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: isSelected ? '2px solid var(--primary)' : '2px solid transparent' }}
                                            />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {friend.display_name?.split(' ')[0]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', opacity: 0.4 }}>
                                {mutualFriends.length === 0 ? 'Follow people first to invite them' : t('no_friends_found')}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="ui-btn ui-btn--primary"
                        style={{ width: '100%', marginTop: '10px', fontSize: '1.1rem', opacity: isSubmitting ? 0.7 : 1 }}
                    >
                        {isSubmitting ? t('processing') : t('preview_invitation')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreatePrivateInvitation;
