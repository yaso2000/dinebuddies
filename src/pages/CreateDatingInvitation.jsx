import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaMoneyBillWave, FaHeart
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import MediaSelector from '../components/Invitations/MediaSelector';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { processInvitationMedia } from '../services/mediaService';
import { getMutualFollowers } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { fetchIpLocation } from '../utils/locationUtils';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';
import { placePhotoProxyUrls } from '../utils/placePhotoUrls';
import './PrivateInvitation.css';
import { goToLogin } from '../utils/goToLogin';

const CreateDatingInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addPrivateInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth();

    const quotaInfo = canCreatePrivateInvitation();

    const [mediaData, setMediaData] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mutualFriends, setMutualFriends] = useState([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [suggestedImages, setSuggestedImages] = useState([]);
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
        occasionType: 'Dating',
    });

    // Populate when editing
    useEffect(() => {
        if (editInvitation) {
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
                occasionType: 'Dating',
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
            goToLogin();
        }
    }, [userProfile, currentUser, navigate]);

    // Fetch mutual followers
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

    // Location detection
    useEffect(() => {
        if (restaurantData) return;

        const detectLocation = async () => {
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, maximumAge: 0 })
                    );
                    const { latitude, longitude } = pos.coords;
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    if (res.ok) {
                        const d = await res.json();
                        const city = d.city || d.locality || d.principalSubdivision || '';
                        if (city) {
                            setFormData(prev => ({ ...prev, city, country: d.countryCode || prev.country, userLat: latitude, userLng: longitude }));
                            return;
                        }
                    }
                } catch { /* GPS denied */ }
            }

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

            const data = await fetchIpLocation();
            if (data.success) {
                setFormData(prev => ({ ...prev, city: data.city, country: data.country_code, userLat: data.latitude, userLng: data.longitude }));
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
        if (placeData.photos?.length > 0) setSuggestedImages(placeData.photos);
    };

    const filteredFriends = mutualFriends.filter(friend =>
        friend.display_name?.toLowerCase().includes(friendSearchQuery.toLowerCase())
    );

    // Dating: max 1 guest
    const MAX_GUESTS = 1;
    const isAtLimit = (formData.invitedFriends || []).length >= MAX_GUESTS;

    const toggleFriendSelection = async (friendId) => {
        const current = formData.invitedFriends || [];
        if (current.includes(friendId)) {
            setFormData(prev => ({ ...prev, invitedFriends: current.filter(id => id !== friendId) }));
            return;
        }

        if (isAtLimit) return;

        // Note: We no longer hard-block based on availableForDating because the field
        // may be incorrect (old toggle bug set it to false for new users).
        // Recipients can always decline a dating invitation.

        setFormData(prev => ({ ...prev, invitedFriends: [friendId] }));
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
            showToast(t('please_invite_one_person') || 'Please invite someone for your date', 'error');
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

            const initialRsvps = {};
            formData.invitedFriends.forEach(friendId => {
                initialRsvps[friendId] = 'pending';
            });

            const draftData = {
                ...formData,
                ...mediaFields,
                rsvps: initialRsvps,
                type: 'Dating',
                status: 'draft',
                createdAt: serverTimestamp()
            };

            if (existingDraftId) {
                const draftRef = doc(db, 'private_invitations', existingDraftId);
                await updateDoc(draftRef, { ...draftData, updatedAt: serverTimestamp() });
                navigate(`/invitation/private/preview/${existingDraftId}`);
            } else {
                const draftId = await addPrivateInvitation(draftData);
                if (draftId) {
                    navigate(`/invitation/private/preview/${draftId}`);
                }
            }
        } catch (error) {
            console.error('Error creating dating draft:', error);
            showToast(t('failed_create_invitation'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Restore Google images when editing
    useEffect(() => {
        if (!formData.location || suggestedImages?.length > 0 || formData.restaurantId) return;

        let cancelled = false;
        const searchQuery = formData.location + (formData.city ? ` ${formData.city}` : '');
        setSuggestedImagesLoading(true);

        loadGoogleMapsScript()
            .then(() => {
                if (cancelled || !window.google?.maps?.places) {
                    if (!cancelled) setSuggestedImagesLoading(false);
                    return;
                }
                try {
                    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                    service.findPlaceFromQuery({ query: searchQuery, fields: ['place_id'] }, (results, status) => {
                        if (cancelled) return;
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
                            if (cancelled) return;
                            setSuggestedImagesLoading(false);
                            setSuggestedImages(placePhotoProxyUrls(results[0].place_id, 5));
                        } else {
                            setSuggestedImagesLoading(false);
                        }
                    });
                } catch (err) {
                    if (!cancelled) setSuggestedImagesLoading(false);
                }
            })
            .catch(() => setSuggestedImagesLoading(false));

        return () => { cancelled = true; setSuggestedImagesLoading(false); };
    }, [formData.location]);

    // No quota → redirect
    if (!quotaInfo.canCreate && !editInvitation) {
        return (
            <div className="private-create-wrapper private-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px' }}>
                <div className="ui-card ui-card--lg" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '30px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>💑</div>
                    <h2 className="ui-prompt__title" style={{ fontSize: '1.6rem', color: '#ec4899', marginBottom: '12px' }}>
                        {t('insufficient_credits')}
                    </h2>
                    <p className="ui-prompt__desc" style={{ marginBottom: '25px' }}>
                        {t('insufficient_credits_desc')}
                    </p>
                    <button onClick={() => navigate('/pricing')} className="ui-btn ui-btn--primary" style={{ width: '100%', marginBottom: '12px', background: 'linear-gradient(135deg, #ec4899, #be185d)' }}>
                        {t('upgrade_now')}
                    </button>
                    <button onClick={() => navigate(-1)} className="ui-btn ui-btn--ghost" style={{ width: '100%' }}>
                        {t('go_back')}
                    </button>
                </div>
            </div>
        );
    }

    const quota = quotaInfo.quota;
    const isUnlimited = quota === 'unlimited' || quota === '∞' || quota === -1;

    return (
        <div className="private-create-wrapper private-theme">
            <div className="private-header-premium" style={{ background: 'linear-gradient(135deg, #1a0010, #2d0020, #1a0010)' }}>
                <button onClick={() => navigate(-1)} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge" style={{ background: 'rgba(236,72,153,0.2)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)' }}>
                    💑 {t('dinebuddy_date', 'DineBuddy Date')}
                </div>
                <h2 className="private-header-title" style={{ color: '#ec4899' }}>
                    <FaHeart />
                    {t('dinebuddy_date', 'DineBuddy Date')}
                </h2>
                <p className="private-header-desc">
                    {t('dating_invitation_desc', 'Send an exclusive private date invitation to one special person.')}
                </p>

                {/* Quota Banner */}
                <div style={{
                    margin: '12px 0 0',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: isUnlimited ? 'rgba(236,72,153,0.1)' : quota <= 1 ? 'rgba(239,68,68,0.1)' : 'rgba(236,72,153,0.1)',
                    border: `1px solid ${isUnlimited ? 'rgba(236,72,153,0.3)' : quota <= 1 ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.3)'}`,
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: '0.875rem',
                    color: isUnlimited ? '#ec4899' : quota <= 1 ? '#f87171' : '#ec4899',
                    fontWeight: 600
                }}>
                    <span>{isUnlimited ? '∞' : `${quota}`}</span>
                    <span style={{ opacity: 0.8, fontWeight: 400 }}>
                        {isUnlimited
                            ? t('unlimited_date_invitations', 'Unlimited date invitations')
                            : t('date_invitations_remaining', `date invitation${quota !== 1 ? 's' : ''} remaining this {{period}}`, { period: t(quotaInfo.period || 'month') })}
                    </span>
                </div>
            </div>

            <div className="private-form-container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={handlePreview} className="elegant-form">

                    {/* Title */}
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

                    {/* Date & Time */}
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

                    {/* Location */}
                    <div className="form-group mb-4">
                        <label className="elegant-label"><FaMapMarkerAlt className="label-icon" /> {t('location')}</label>
                        <VenueLocationPicker
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

                    {/* Media */}
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
                                        borderColor: formData.paymentType === type ? '#ec4899' : 'var(--border-color)',
                                        background: formData.paymentType === type ? 'rgba(236,72,153,0.1)' : 'transparent',
                                        color: formData.paymentType === type ? '#ec4899' : 'var(--text-main)',
                                        fontWeight: '700',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {t(type.toLowerCase().replace(' ', '_'))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message */}
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
                        />
                    </div>

                    {/* Date Selection — 1 person only */}
                    <div className="form-group mb-4" style={{ background: 'rgba(236,72,153,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(236,72,153,0.2)' }}>
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span><FaUserFriends /> {t('select_your_date', 'Select Your Date')}</span>
                            <span style={{
                                color: isAtLimit ? '#ec4899' : 'var(--text-muted)',
                                fontSize: '0.8rem',
                                fontWeight: 700
                            }}>
                                {formData.invitedFriends.length}/{MAX_GUESTS}
                                {isAtLimit && ' 💑'}
                            </span>
                        </label>

                        {isAtLimit && (
                            <div style={{
                                marginBottom: 10,
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'rgba(236,72,153,0.08)',
                                border: '1px solid rgba(236,72,153,0.3)',
                                color: '#ec4899',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                💑 {t('dating_one_person_selected', 'Your date is selected. Remove to choose someone else.')}
                            </div>
                        )}

                        {/* Search */}
                        <div style={{ position: 'relative', marginBottom: 12 }}>
                            <input
                                type="text"
                                placeholder={t('search_friends')}
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid rgba(236,72,153,0.3)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            />
                            <FaSearch style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        </div>

                        {/* Friends grid */}
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
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                padding: '10px 6px', borderRadius: 12,
                                                background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1.5px solid ${isSelected ? '#ec4899' : 'rgba(255,255,255,0.07)'}`,
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isDisabled ? 0.4 : 1,
                                                transition: 'all 0.18s',
                                                position: 'relative'
                                            }}
                                        >
                                            {isSelected && (
                                                <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <FaHeart style={{ color: 'white', fontSize: '0.5rem' }} />
                                                </div>
                                            )}
                                            <img
                                                src={getSafeAvatar(friend)}
                                                alt={friend.display_name}
                                                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isSelected ? '#ec4899' : getGenderBorderColor(friend)}` }}
                                            />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isSelected ? '#ec4899' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        style={{
                            width: '100%', marginTop: '10px', fontSize: '1.1rem',
                            opacity: isSubmitting ? 0.7 : 1,
                            background: 'linear-gradient(135deg, #ec4899, #be185d)',
                            border: 'none'
                        }}
                    >
                        {isSubmitting ? t('processing') : t('preview_invitation')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateDatingInvitation;
