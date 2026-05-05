import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaMoneyBillWave, FaUsers, FaBriefcase,
    FaBirthdayCake, FaMoon, FaUtensils, FaCoffee, FaGamepad,
    FaStar, FaHome, FaFilm, FaFutbol, FaFire, FaMagic
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import MediaSelector from '../components/Invitations/MediaSelector';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { processInvitationMedia } from '../services/mediaService';
import { getFollowing } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import { serverTimestamp, updateDoc, doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './PrivateInvitation.css';
import { goToLogin } from '../utils/goToLogin';
import { resolveVenueCountryIso } from '../utils/countryIso';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import PrivateCardBackgroundPicker from '../components/Invitations/privateCard/PrivateCardBackgroundPicker';
import PrivateCardFontPicker from '../components/Invitations/privateCard/PrivateCardFontPicker';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import { resolveOccasionCategoryId } from '../components/Invitations/privateCard/privateCardOccasionMap';
import { getCardBackgroundOptions } from '../components/Invitations/privateCard/privateCardBackgrounds';
import { callGenerateInvitationImage } from '../utils/callGenerateInvitationImage';
import { createAiInvitationCoverMediaData } from '../utils/createAiInvitationCoverMediaData';
import { getTotalDineCredits, PRIVATE_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';

const CreatePrivateInvitation = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addPrivateInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth();

    const quotaInfo = canCreatePrivateInvitation('private');

    // UI State
    const [mediaData, setMediaData] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [magicImageLoading, setMagicImageLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mutualFriends, setMutualFriends] = useState([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendSearchLoading, setFriendSearchLoading] = useState(false);
    const [friendSearchResults, setFriendSearchResults] = useState([]);
    const [existingDraftId, setExistingDraftId] = useState(null);
    const [cardFontId, setCardFontId] = useState(DEFAULT_FONT_ID);
    const [cardBackgroundId, setCardBackgroundId] = useState(null);

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
                const imgUrl = editInvitation.customImage || editInvitation.image;
                setMediaData({
                    source: 'custom_image',
                    type: 'image',
                    url: imgUrl,
                    preview: imgUrl,
                    file: null,
                    isCustom: !!editInvitation.customImage
                });
            }

            setCardFontId(editInvitation.cardFontId || DEFAULT_FONT_ID);
        }
    }, [editInvitation]);

    /** Sync card background when occasion or loaded draft changes (birthday = 3 assets; others = none). */
    useEffect(() => {
        const cat = resolveOccasionCategoryId(formData.occasionType);
        const opts = getCardBackgroundOptions(cat);
        if (opts.length === 0) {
            setCardBackgroundId(null);
            return;
        }
        if (
            editInvitation?.cardBackgroundId &&
            opts.some((o) => o.id === editInvitation.cardBackgroundId)
        ) {
            setCardBackgroundId(editInvitation.cardBackgroundId);
            return;
        }
        setCardBackgroundId((prev) => (prev && opts.some((o) => o.id === prev) ? prev : opts[0].id));
    }, [formData.occasionType, editInvitation?.id]);

    // Redirect guests
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            goToLogin();
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
                // People you follow (not mutual-only) so invite list is usable when they have not followed back yet.
                const friends = await getFollowing(userId, followingIds);
                setMutualFriends(friends);
            } catch (error) {
                console.error('Error fetching friends:', error);
            } finally {
                setFriendsLoading(false);
            }
        };
        fetchFriends();
    }, [authUser, currentUser, userProfile]);

    // Unified location discovery for all users/pages.
    useEffect(() => {
        if (restaurantData) return;

        const detectLocation = async () => {
            const detected = await detectUserLocationContext(userProfile);
            if (!detected.success) return;
            setFormData(prev => ({
                ...prev,
                city: detected.city || prev.city,
                country: detected.country || prev.country || '',
                countryCode: detected.countryCode || prev.countryCode || '',
                userLat: detected.latitude ?? prev.userLat,
                userLng: detected.longitude ?? prev.userLng
            }));
        };

        detectLocation();
    }, [restaurantData, userProfile]);

    const handleLocationSelect = (placeData) => {
        setFormData(prev => ({
            ...prev,
            location: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title
        }));
    };

    useEffect(() => {
        const rawQ = friendSearchQuery.trim();
        const searchQ = rawQ.toLowerCase();
        const uid = authUser?.uid || currentUser?.uid || currentUser?.id;
        if (!rawQ || rawQ.length < 2 || !uid) {
            setFriendSearchResults([]);
            setFriendSearchLoading(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setFriendSearchLoading(true);
            try {
                const localMatches = mutualFriends.filter((friend) => {
                    const name = `${friend.display_name || ''} ${friend.name || ''}`.trim().toLowerCase();
                    return name.includes(searchQ);
                });

                const q2 = `${rawQ}\uf8ff`;
                const usersRef = collection(db, 'users');
                const [displayNameSnap, displayNameCamelSnap] = await Promise.all([
                    getDocs(query(usersRef, orderBy('display_name'), where('display_name', '>=', rawQ), where('display_name', '<=', q2), limit(20))),
                    getDocs(query(usersRef, orderBy('displayName'), where('displayName', '>=', rawQ), where('displayName', '<=', q2), limit(20)))
                ]);

                const merged = new Map();
                const addCandidate = (id, data) => {
                    if (!id || id === uid) return;
                    const role = (data?.role || '').toLowerCase();
                    if (role === 'business' || role === 'guest' || data?.isBusiness === true || data?.isGuest === true) return;
                    const display = data?.display_name || data?.displayName || data?.name || '';
                    if (!display) return;
                    const normalized = {
                        id,
                        display_name: display,
                        name: display,
                        photo_url: data?.photo_url || data?.photoURL || data?.avatar || '',
                        photoURL: data?.photoURL || data?.photo_url || data?.avatar || '',
                        avatar: data?.avatar || data?.photo_url || data?.photoURL || '',
                        gender: data?.gender || null
                    };
                    const matchText = `${normalized.display_name} ${normalized.name}`.toLowerCase();
                    if (!matchText.includes(searchQ)) return;
                    merged.set(id, normalized);
                };

                localMatches.forEach((f) => addCandidate(f.id, f));
                displayNameSnap.forEach((d) => addCandidate(d.id, d.data() || {}));
                displayNameCamelSnap.forEach((d) => addCandidate(d.id, d.data() || {}));

                if (!cancelled) {
                    setFriendSearchResults(Array.from(merged.values()));
                }
            } catch (error) {
                console.error('Private invite friend search failed:', error);
                if (!cancelled) setFriendSearchResults([]);
            } finally {
                if (!cancelled) setFriendSearchLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [friendSearchQuery, authUser?.uid, currentUser?.uid, currentUser?.id, mutualFriends]);

    const searchQ = friendSearchQuery.trim().toLowerCase();
    const filteredFriends = searchQ ? friendSearchResults : mutualFriends;

    // Max guests per private invitation
    const getMaxGuests = () => 30;

    const maxGuests = getMaxGuests();
    const isAtLimit = (formData.invitedFriends || []).length >= maxGuests;

    const toggleFriendSelection = (friendId) => {
        const current = formData.invitedFriends || [];
        if (current.includes(friendId)) {
            setFormData(prev => ({ ...prev, invitedFriends: current.filter(id => id !== friendId) }));
            return;
        }

        // Block adding if at limit
        if (current.length >= getMaxGuests()) return;

        setFormData(prev => ({ ...prev, invitedFriends: [...(prev.invitedFriends || []), friendId] }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMagicCoverImage = async () => {
        if (!authUser || currentUser?.id === 'guest') {
            showToast(t('login_to_create') || 'Please sign in', 'error');
            goToLogin();
            return;
        }
        setMagicImageLoading(true);
        try {
            const prompt =
                [formData.title, formData.location, formData.restaurantName, formData.description]
                    .filter((x) => String(x || '').trim())
                    .join(' — ')
                    .slice(0, 2400) ||
                `${String(formData.occasionType || 'social')} private invitation`;
            const style = String(formData.occasionType || '').trim() || 'private invitation';
            const apiResult = await callGenerateInvitationImage({ prompt, style });
            const mediaPayload = await createAiInvitationCoverMediaData(apiResult);
            setMediaData(mediaPayload);
            showToast(t('invitation_magic_image_success'), 'success');
        } catch (e) {
            if (e.code === 'insufficient_credits') {
                showToast(t('invitation_magic_image_insufficient'), 'error');
            } else {
                showToast(e.message || t('invitation_magic_image_error'), 'error');
            }
        } finally {
            setMagicImageLoading(false);
        }
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
                cardFrameColorId: DEFAULT_FRAME_COLOR_ID,
                cardFontId,
                cardBackgroundId: cardBackgroundId || null,
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

    if (!quotaInfo.canCreate && !editInvitation) {
        return (
            <div className="private-create-wrapper private-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px' }}>
                <div className="ui-card ui-card--lg" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '30px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔐</div>
                    <h2 className="ui-prompt__title" style={{ fontSize: '1.6rem', color: 'var(--luxury-gold)', marginBottom: '12px' }}>
                        {t('insufficient_credits')}
                    </h2>
                    <p className="ui-prompt__desc" style={{ marginBottom: '25px' }}>
                        {t(
                            'dine_credits_private_insufficient',
                            `Publishing a private invitation costs ${PRIVATE_INVITATION_PUBLISH_CREDITS} Dine Credits. Add credits in your wallet (Settings → Dine Credits).`
                        )}
                    </p>
                    <button
                        onClick={() => navigate('/settings/credits')}
                        className="ui-btn ui-btn--primary"
                        style={{ width: '100%', marginBottom: '12px' }}
                    >
                        {t('open_dine_credits_wallet', 'Dine Credits wallet')}
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

    const quota = quotaInfo.quota;
    const isUnlimited = quota === 'unlimited' || quota === '∞' || quota === -1;
    const dineBalance = getTotalDineCredits(userProfile);
    const publishCost = PRIVATE_INVITATION_PUBLISH_CREDITS;

    return (
        <div className="private-create-wrapper private-theme">
            <div className="private-header-premium">
                <button onClick={() => navigate(-1)} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge">
                    🔒 {t('dinebuddy_private', 'DineBuddy Private')}
                </div>
                <h2 className="private-header-title">
                    <FaLock />
                    {t('dinebuddy_private', 'DineBuddy Private')}
                </h2>
                <p className="private-header-desc">
                    {t('private_invitation_desc', 'This invitation will not be visible to the public. Only people you invite can see and join.')}
                </p>

                {/* Private invitation credits (purchased packs only — no subscription tiers). */}
                <div style={{
                    margin: '12px 0 0',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: isUnlimited
                        ? 'rgba(72,187,120,0.1)'
                        : dineBalance < publishCost
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(139,92,246,0.1)',
                    border: `1px solid ${isUnlimited ? 'rgba(72,187,120,0.3)' : dineBalance < publishCost ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.875rem',
                    color: isUnlimited ? '#4ade80' : dineBalance < publishCost ? '#f87171' : '#a78bfa',
                    fontWeight: 600
                }}>
                    <span>{isUnlimited ? '∞' : `${dineBalance}`}</span>
                    <span style={{ opacity: 0.85, fontWeight: 400 }}>
                        {isUnlimited
                            ? t('unlimited_private_invitations', 'Unlimited private invitations')
                            : t(
                                  'dine_credits_private_banner',
                                  '{{balance}} Dine Credits — publishing uses {{cost}} credits (free pool is used first).',
                                  { balance: dineBalance, cost: publishCost }
                              )}
                    </span>
                </div>
            </div>

            <div className="private-form-container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={handlePreview} className="elegant-form">
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
                                { id: 'birthday', icon: <FaBirthdayCake />, label: 'Birthday' },
                                { id: 'social', icon: <FaUsers />, label: 'Social' },
                                { id: 'work', icon: <FaBriefcase />, label: 'Work' },
                                { id: 'nightlife', icon: <FaMoon />, label: 'Nightlife' },
                                { id: 'dining', icon: <FaUtensils />, label: 'Dining' },
                                { id: 'cafe', icon: <FaCoffee />, label: 'Café' },
                                { id: 'gaming', icon: <FaGamepad />, label: 'Gaming' },
                                { id: 'family', icon: <FaHome />, label: 'Family' },
                                { id: 'celebration', icon: <FaStar />, label: 'Celebration' },
                                { id: 'cinema', icon: <FaFilm />, label: 'Cinema' },
                                { id: 'sports', icon: <FaFutbol />, label: 'Sports' },
                                { id: 'bbq', icon: <FaFire />, label: 'BBQ' },
                            ].map((occ) => {
                                const selected = formData.occasionType === occ.label;
                                return (
                                    <div
                                        key={occ.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFormData((prev) => ({ ...prev, occasionType: occ.label }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setFormData((prev) => ({ ...prev, occasionType: occ.label }));
                                            }
                                        }}
                                        className={`private-occasion-chip${selected ? ' private-occasion-chip--selected' : ''}`}
                                    >
                                        <span className="private-occasion-chip__icon">{occ.icon}</span>
                                        {t(`occasion_${occ.id}`, occ.label)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="form-group mb-4 venue-search-stack">
                        <label className="elegant-label"><FaMapMarkerAlt className="label-icon" /> {t('location')}</label>
                        <VenueLocationPicker
                            value={formData.location}
                            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                            onSelect={handleLocationSelect}
                            city={formData.city}
                            countryCode={resolveVenueCountryIso(formData, userProfile)}
                            userLat={formData.userLat ?? userProfile?.coordinates?.lat}
                            userLng={formData.userLng ?? userProfile?.coordinates?.lng}
                            className="elegant-input"
                        />
                    </div>

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

                    <div className="form-group mb-4">
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {t('message_to_friends')}
                            <span style={{ fontSize: '0.75rem', color: (formData.description?.length || 0) >= 300 ? '#f87171' : 'var(--text-muted)' }}>
                                {(formData.description?.length || 0)}/300
                            </span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder={t('write_something_personal')}
                            className="elegant-textarea"
                            rows="3"
                            maxLength={300}
                        ></textarea>
                    </div>

                    <div className="form-group mb-4">
                        <label className="elegant-label">{t('invitation_media')}</label>
                        <MediaSelector
                            restaurant={{
                                image: formData.restaurantImage || formData.image,
                                restaurantImage: formData.restaurantImage || formData.image,
                                name: formData.restaurantName
                            }}
                            mediaData={mediaData}
                            onMediaSelect={(data) => setMediaData(data)}
                        />
                        <div style={{ marginTop: '14px' }}>
                            <button
                                type="button"
                                onClick={handleMagicCoverImage}
                                disabled={magicImageLoading || !authUser || currentUser?.id === 'guest'}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    maxWidth: '360px',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor:
                                        magicImageLoading || !authUser || currentUser?.id === 'guest'
                                            ? 'not-allowed'
                                            : 'pointer',
                                    opacity: magicImageLoading ? 0.85 : 1,
                                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                    color: '#fff',
                                }}
                            >
                                <FaMagic aria-hidden />
                                {magicImageLoading
                                    ? t('invitation_magic_image_loading')
                                    : t('invitation_magic_image_btn')}
                            </button>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                                {t('invitation_magic_image_hint')}
                            </p>
                        </div>
                    </div>

                    <div className="form-group mb-4">
                        <label className="elegant-label">
                            {t('private_card_preview_label', { defaultValue: 'Invitation card' })}
                        </label>
                        <div className="private-card-preview-with-bg">
                            <div className="private-card-preview-with-bg__preview-wrap">
                                <PrivateInvitationCardPreview
                                    className="private-invitation-card-preview--showcase private-invitation-card-preview--showcase-compact"
                                    frameColorId={DEFAULT_FRAME_COLOR_ID}
                                    cardFontId={cardFontId}
                                    occasionType={formData.occasionType}
                                    cardBackgroundId={cardBackgroundId}
                                    title={formData.title}
                                    description={formData.description}
                                    date={formData.date}
                                    time={formData.time}
                                    location={formData.location}
                                    inviterName={
                                        userProfile?.display_name ||
                                        userProfile?.displayName ||
                                        currentUser?.display_name ||
                                        currentUser?.displayName ||
                                        ''
                                    }
                                    inviterAvatarUrl={getSafeAvatar(userProfile || currentUser || {})}
                                />
                            </div>
                            <PrivateCardBackgroundPicker
                                layout="beside-preview"
                                categoryId={resolveOccasionCategoryId(formData.occasionType)}
                                value={cardBackgroundId}
                                onChange={setCardBackgroundId}
                            />
                        </div>
                        <PrivateCardFontPicker value={cardFontId} onChange={setCardFontId} />
                    </div>

                    {/* Payment Type */}
                    <div className="form-group mb-4">
                        <label className="elegant-label"><FaMoneyBillWave /> {t('payment_type')}</label>
                        <div className="payment-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {['Split', 'Host Pays'].map((type) => {
                                const selected = formData.paymentType === type;
                                return (
                                    <div
                                        key={type}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFormData((prev) => ({ ...prev, paymentType: type }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setFormData((prev) => ({ ...prev, paymentType: type }));
                                            }
                                        }}
                                        className={`private-payment-chip${selected ? ' private-payment-chip--selected' : ''}`}
                                    >
                                        {t(type.toLowerCase().replace(' ', '_'))}
                                    </div>
                                );
                            })}
                        </div>
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
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#f87171',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                {'⛔ ' + t('max_guests_reached', { count: maxGuests, defaultValue: `Maximum of ${maxGuests} guests reached` })}
                            </div>
                        )}

                        {/* Search bar */}
                        <div style={{ position: 'relative', marginBottom: 12 }}>
                            <input
                                type="text"
                                placeholder={t('search_friends')}
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                className="private-friend-search-input"
                                autoComplete="off"
                            />
                            <FaSearch
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    opacity: 0.45,
                                    color: 'rgba(148, 163, 184, 0.9)',
                                    pointerEvents: 'none'
                                }}
                            />
                        </div>

                        {/* Friend grid */}
                        {friendsLoading || friendSearchLoading ? (
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
                                                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isSelected ? 'var(--primary)' : getGenderBorderColor(friend)}` }}
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
                                {mutualFriends.length === 0 ? t('follow_people_first', 'Follow people first to invite them') : t('no_friends_found')}
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
