import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaMoneyBillWave, FaEdit, FaHeart, FaUsers, FaBriefcase, FaSmile,
    FaBirthdayCake, FaMoon, FaUtensils, FaCoffee, FaGamepad
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
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
import './PrivateInvitation.css';

const CreatePrivateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
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
        city: restaurantData?.city || '',
        country: restaurantData?.country || '',
        lat: restaurantData?.lat || restaurantData?.coordinates?.lat,
        lng: restaurantData?.lng || restaurantData?.coordinates?.lng,
        userLat: null,
        userLng: null,
        occasionType: editInvitation?.occasionType || 'social', // Default occasion
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
        if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
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

    // Automatic City detection (Implicit Profile Location or IP Fallback)
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
                setFormData(prev => ({
                    ...prev,
                    city: prev.city || data.city,
                    country: prev.country || data.country_code,
                    userLat: prev.userLat || data.latitude,
                    userLng: prev.userLng || data.longitude
                }));
            }
        };

        if (!restaurantData) {
            const profileFound = setLocationFromProfile();
            // Always try IP as a secondary source if profile is incomplete
            fetchLocation();
        }
    }, [userProfile, restaurantData]);

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

    const toggleFriendSelection = (friendId) => {
        setFormData(prev => {
            const current = prev.invitedFriends || [];
            if (current.includes(friendId)) {
                return { ...prev, invitedFriends: current.filter(id => id !== friendId) };
            } else {
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
            alert(t('please_fill_required_fields') || 'Please fill in all required fields');
            return;
        }

        if (formData.invitedFriends.length === 0) {
            alert(t('please_invite_at_least_one_guest') || 'Please invite at least one guest for a private invitation');
            return;
        }

        setIsSubmitting(true);
        try {
            let mediaFields = {};
            if (mediaData) {
                const userId = currentUser?.id || authUser?.uid;
                mediaFields = await processInvitationMedia(mediaData, userId);
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
                const draftRef = doc(db, 'invitations', existingDraftId);
                await updateDoc(draftRef, {
                    ...draftData,
                    updatedAt: serverTimestamp()
                });
                navigate(`/invitation/private/preview/${existingDraftId}`);
            } else {
                // CREATE NEW
                const draftId = await addInvitation(draftData);
                if (draftId) {
                    navigate(`/invitation/private/preview/${draftId}`);
                }
            }
        } catch (error) {
            console.error('Error creating private draft:', error);
            alert(t('failed_create_invitation'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Restore Google Images when editing
    useEffect(() => {
        const restoreImages = () => {
            // Only attempt restore if:
            // 1. We have a location
            // 2. We DON'T have suggested images already
            // 3. We DON'T have a specific restaurant (which provides its own photos)
            if (formData.location &&
                (!suggestedImages || suggestedImages.length === 0) &&
                !formData.restaurantId &&
                window.google?.maps?.places) {

                const searchQuery = formData.location + (formData.city ? ` ${formData.city}` : '');
                console.log('🔄 Restoring Google Images for:', searchQuery);

                try {
                    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                    service.findPlaceFromQuery({
                        query: searchQuery,
                        fields: ['place_id']
                    }, (results, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
                            service.getDetails({
                                placeId: results[0].place_id,
                                fields: ['photos']
                            }, (details, dStatus) => {
                                if (dStatus === window.google.maps.places.PlacesServiceStatus.OK && details.photos) {
                                    const urls = details.photos.slice(0, 5).map(p => p.getUrl({ maxWidth: 800 }));
                                    setSuggestedImages(urls);
                                }
                            });
                        }
                    });
                } catch (err) {
                    console.error('❌ Photo restore error:', err);
                }
            }
        };

        const timer = setTimeout(restoreImages, 2000); // Slightly longer delay to allow autocomplete to finish
        return () => clearTimeout(timer);
    }, [formData.location]);

    if (!quotaInfo.canCreate && !editInvitation) {
        return (
            <div className="private-create-wrapper private-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px' }}>
                <div style={{
                    background: 'var(--bg-dark)',
                    borderRadius: '24px',
                    padding: '30px',
                    textAlign: 'center',
                    border: '1px solid var(--border-color)',
                    maxWidth: '400px',
                    width: '100%',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔐</div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '900', marginBottom: '12px', color: 'var(--luxury-gold)' }}>
                        {t('insufficient_credits')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '25px', lineHeight: '1.6', fontSize: '0.95rem' }}>
                        {t('insufficient_credits_desc')}
                    </p>
                    <button
                        onClick={() => navigate('/subscription')}
                        className="btn-primary"
                        style={{ width: '100%', padding: '16px', borderRadius: '14px', fontWeight: '800', marginBottom: '12px', background: 'linear-gradient(135deg, #f59e0b, #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
                    >
                        {t('upgrade_now')}
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: '600' }}
                    >
                        {t('go_back')}
                    </button>
                </div>
            </div>
        );
    }

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

                    {/* Friend Selection */}
                    <div className="form-group mb-4" style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span><FaUserFriends /> {t('invite_friends')}</span>
                            {formData.invitedFriends.length > 0 && (
                                <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>
                                    {formData.invitedFriends.length} {t('selected')}
                                </span>
                            )}
                        </label>
                        <div style={{ position: 'relative', margin: '10px 0' }}>
                            <input
                                type="text"
                                placeholder={t('search_friends')}
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '10px 35px 10px 15px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                            />
                            <FaSearch style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {friendsLoading ? (
                                <div style={{ textAlign: 'center', padding: '10px' }}>{t('loading')}</div>
                            ) : filteredFriends.length > 0 ? (
                                filteredFriends.map(friend => {
                                    const isSelected = formData.invitedFriends.includes(friend.id);
                                    return (
                                        <div
                                            key={friend.id}
                                            onClick={() => toggleFriendSelection(friend.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '8px 12px',
                                                borderRadius: '10px',
                                                background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                                                cursor: 'pointer',
                                                border: '1px solid',
                                                borderColor: isSelected ? 'var(--primary)' : 'transparent'
                                            }}
                                        >
                                            <img src={getSafeAvatar(friend)} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                            <span style={{ flex: 1, fontSize: '0.9rem' }}>{friend.display_name}</span>
                                            {isSelected && <FaCheckCircle style={{ color: 'var(--primary)' }} />}
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', opacity: 0.5 }}>{t('no_friends_found')}</div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: '14px',
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            marginTop: '10px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: isSubmitting ? 0.7 : 1
                        }}
                    >
                        {isSubmitting ? t('processing') : t('preview_invitation')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreatePrivateInvitation;
