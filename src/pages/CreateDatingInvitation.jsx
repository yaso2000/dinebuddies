import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaHeart, FaCamera, FaUpload, FaImage
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { processInvitationMedia } from '../services/mediaService';
import { getMutualFollowers } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './PrivateInvitation.css';
import { goToLogin } from '../utils/goToLogin';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { getTotalDineCredits, DATING_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import PrivateCardDatingTypographySheet from '../components/Invitations/privateCard/PrivateCardDatingTypographySheet';
import PrivateCardMotionPicker from '../components/Invitations/privateCard/PrivateCardMotionPicker';
import { DEFAULT_FRAME_COLOR_ID, getFrameColorById } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID, PRIVATE_CARD_FONTS } from '../components/Invitations/privateCard/privateCardFonts';
import { DEFAULT_MOTION_ID } from '../components/Invitations/privateCard/privateCardMotions';
import {
    getDatingCardBackgroundOptions,
    getFirstDatingBackgroundFileUrl,
    getDatingHeroCoverFromMediaData,
    parseDatingCoverTemplateIdFromUrl
} from '../components/Invitations/datingCard/datingCardBackgrounds';
import DatingCoverCameraPanel from '../components/Invitations/datingCard/DatingCoverCameraPanel';
import DatingPreviewRightRail from '../components/Invitations/datingCard/DatingPreviewRightRail';

const CreateDatingInvitation = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addPrivateInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth();

    const quotaInfo = canCreatePrivateInvitation('dating');

    const [mediaData, setMediaData] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mutualFriends, setMutualFriends] = useState([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [existingDraftId, setExistingDraftId] = useState(null);
    const [cardFontId, setCardFontId] = useState(DEFAULT_FONT_ID);
    const [cardFrameColorId, setCardFrameColorId] = useState(DEFAULT_FRAME_COLOR_ID);
    /** `#rrggbb` or null — one color for frame border + all text; null uses `cardFrameColorId` preset. */
    const [datingCardThemeColor, setDatingCardThemeColor] = useState(null);
    const [typographySheetOpen, setTypographySheetOpen] = useState(false);
    const [cardMotionId, setCardMotionId] = useState(DEFAULT_MOTION_ID);
    const [cardBackgroundId, setCardBackgroundId] = useState(null);
    const [datingCoverTab, setDatingCoverTab] = useState('camera');
    /** Bumps when user selects the Camera cover tab (or taps it again) to open the recorder. */
    const [cameraOpenNonce, setCameraOpenNonce] = useState(0);
    /** Dating card: show personal message + profile on the preview (default on). */
    const [datingCardShowHostAndMessage, setDatingCardShowHostAndMessage] = useState(true);

    /** Persist cover media per tab when switching Camera / Upload / Template */
    const datingCoverDraftsRef = useRef({ template: null, upload: null, camera: null });
    const mediaDataRef = useRef(null);
    const datingCoverTabRef = useRef('camera');

    useEffect(() => {
        mediaDataRef.current = mediaData;
    }, [mediaData]);
    useEffect(() => {
        datingCoverTabRef.current = datingCoverTab;
    }, [datingCoverTab]);

    const datingHeroCover = useMemo(() => getDatingHeroCoverFromMediaData(mediaData), [mediaData]);

    const datingFontSummary = useMemo(() => {
        const f = PRIVATE_CARD_FONTS.find((x) => x.id === cardFontId);
        return f ? t(f.labelKey, { defaultValue: f.defaultLabel }) : cardFontId;
    }, [cardFontId, t]);

    const datingCardColorSummary = useMemo(() => {
        const raw = typeof datingCardThemeColor === 'string' ? datingCardThemeColor.trim() : '';
        if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
        const fr = getFrameColorById(cardFrameColorId);
        return t(fr.labelKey, { defaultValue: fr.defaultLabel });
    }, [datingCardThemeColor, cardFrameColorId, t]);

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
            setDatingCardShowHostAndMessage(editInvitation.datingCardShowHostAndMessage !== false);

            const videoUrl = editInvitation.customVideo;
            const imgUrl = editInvitation.customImage || editInvitation.image;
            if (videoUrl) {
                const m = {
                    source: 'custom_video',
                    type: 'video',
                    preview: videoUrl,
                    file: null,
                    videoThumbnail: editInvitation.videoThumbnail
                };
                setDatingCoverTab('camera');
                setMediaData(m);
                datingCoverDraftsRef.current = { template: null, upload: null, camera: m };
            } else if (imgUrl) {
                const templateId = parseDatingCoverTemplateIdFromUrl(imgUrl);
                if (templateId) {
                    const m = {
                        source: 'custom_image',
                        type: 'image',
                        preview: imgUrl,
                        file: null,
                        coverTemplateId: templateId
                    };
                    setDatingCoverTab('template');
                    setMediaData(m);
                    datingCoverDraftsRef.current = { template: m, upload: null, camera: null };
                } else {
                    const m = {
                        source: 'custom_image',
                        type: 'image',
                        preview: imgUrl,
                        url: imgUrl,
                        file: null
                    };
                    setDatingCoverTab('upload');
                    setMediaData(m);
                    datingCoverDraftsRef.current = { template: null, upload: m, camera: null };
                }
            } else {
                setDatingCoverTab('camera');
                datingCoverDraftsRef.current = { template: null, upload: null, camera: null };
            }

            setCardFontId(editInvitation.cardFontId || DEFAULT_FONT_ID);
            setCardFrameColorId(editInvitation.cardFrameColorId || DEFAULT_FRAME_COLOR_ID);
            const rawTheme =
                (typeof editInvitation.datingCardThemeColor === 'string' && editInvitation.datingCardThemeColor.trim()) ||
                (typeof editInvitation.datingCardTextColor === 'string' && editInvitation.datingCardTextColor.trim()) ||
                '';
            setDatingCardThemeColor(/^#[0-9A-Fa-f]{6}$/.test(rawTheme) ? rawTheme : null);
            setCardMotionId(editInvitation.cardMotionId || DEFAULT_MOTION_ID);
        }
    }, [editInvitation]);

    /** Default dating card background + validate when opening editor */
    useEffect(() => {
        const opts = getDatingCardBackgroundOptions();
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
    }, [editInvitation?.id]);

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
                const enrichedFriends = await Promise.all(
                    friends.map(async (friend) => {
                        try {
                            const friendDoc = await getDoc(doc(db, 'users', friend.id));
                            const friendData = friendDoc.exists() ? friendDoc.data() : {};
                            return {
                                ...friend,
                                availableForDating: friendData.availableForDating !== false
                            };
                        } catch {
                            return {
                                ...friend,
                                availableForDating: true
                            };
                        }
                    })
                );
                setMutualFriends(enrichedFriends);
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

        const target = mutualFriends.find((f) => f.id === friendId);
        if (target?.availableForDating === false) {
            showToast(t('dating_invite_disabled_by_user', 'This person has disabled receiving dating invitations.'), 'error');
            return;
        }

        setFormData(prev => ({ ...prev, invitedFriends: [friendId] }));
    };

    const revokeBlobPreview = (prev) => {
        if (prev?.preview && String(prev.preview).startsWith('blob:')) {
            try {
                URL.revokeObjectURL(prev.preview);
            } catch {
                /* ignore */
            }
        }
        if (prev?.videoThumbnail && String(prev.videoThumbnail).startsWith('blob:')) {
            try {
                URL.revokeObjectURL(prev.videoThumbnail);
            } catch {
                /* ignore */
            }
        }
    };

    const setCoverMedia = (next) => {
        setMediaData((prev) => {
            let resolved;
            if (next === null) {
                revokeBlobPreview(prev);
                resolved = null;
            } else if (typeof next === 'function') {
                resolved = next(prev);
                if (
                    prev?.preview &&
                    String(prev.preview).startsWith('blob:') &&
                    resolved?.preview !== prev.preview
                ) {
                    revokeBlobPreview(prev);
                }
            } else {
                if (
                    prev?.preview &&
                    String(prev.preview).startsWith('blob:') &&
                    prev.preview !== next?.preview
                ) {
                    revokeBlobPreview(prev);
                }
                resolved = next;
            }
            datingCoverDraftsRef.current[datingCoverTabRef.current] = resolved;
            return resolved;
        });
    };

    const applyDatingTemplateCover = (templateId) => {
        const url = getFirstDatingBackgroundFileUrl(templateId);
        if (!url) return;
        setCardBackgroundId(templateId);
        const m = {
            source: 'custom_image',
            type: 'image',
            preview: url,
            file: null,
            coverTemplateId: templateId
        };
        datingCoverDraftsRef.current.template = m;
        setMediaData(m);
    };

    const handleDatingCoverTab = (tab) => {
        if (tab === datingCoverTab) {
            if (tab === 'camera') setCameraOpenNonce((n) => n + 1);
            return;
        }
        datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;

        setDatingCoverTab(tab);
        const restored = datingCoverDraftsRef.current[tab];

        if (tab === 'template') {
            if (restored?.coverTemplateId) {
                setCardBackgroundId(restored.coverTemplateId);
                setMediaData(restored);
            } else {
                const opts = getDatingCardBackgroundOptions();
                const id =
                    (cardBackgroundId && opts.some((o) => o.id === cardBackgroundId)
                        ? cardBackgroundId
                        : null) || opts[0]?.id;
                if (id) applyDatingTemplateCover(id);
            }
        } else {
            setMediaData(restored ?? null);
        }

        if (tab === 'camera') {
            setCameraOpenNonce((n) => n + 1);
        }
    };

    const datingCoverTabBtnStyle = (active) => ({
        flex: 1,
        padding: '10px 8px',
        borderRadius: 12,
        border: `1px solid ${active ? '#ec4899' : 'rgba(255,255,255,0.12)'}`,
        background: active ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.04)',
        color: active ? '#ec4899' : 'var(--text-main)',
        fontWeight: 700,
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        minWidth: 0,
        transition: 'all 0.2s'
    });

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
                cardFrameColorId,
                cardFontId,
                cardMotionId,
                cardBackgroundId: cardBackgroundId || null,
                datingCardThemeColor,
                datingCardShowHostAndMessage,
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
                        {t(
                            'dine_credits_dating_insufficient',
                            `Publishing a date invitation costs ${DATING_INVITATION_PUBLISH_CREDITS} Dine Credits. Add credits in your wallet (Settings → Dine Credits).`
                        )}
                    </p>
                    <button onClick={() => navigate('/settings/credits')} className="ui-btn ui-btn--primary" style={{ width: '100%', marginBottom: '12px', background: 'linear-gradient(135deg, #ec4899, #be185d)' }}>
                        {t('open_dine_credits_wallet', 'Dine Credits wallet')}
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
    const profilePending = Boolean(quotaInfo.profileLoading) || quota === 'pending';
    const dineBalance = getTotalDineCredits(userProfile);
    const publishCost = DATING_INVITATION_PUBLISH_CREDITS;
    const lowCredits = !isUnlimited && !profilePending && dineBalance < publishCost;

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

                <div style={{
                    margin: '12px 0 0',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: isUnlimited ? 'rgba(236,72,153,0.1)' : lowCredits ? 'rgba(239,68,68,0.1)' : 'rgba(236,72,153,0.1)',
                    border: `1px solid ${isUnlimited ? 'rgba(236,72,153,0.3)' : lowCredits ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.3)'}`,
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: '0.875rem',
                    color: isUnlimited ? '#ec4899' : lowCredits ? '#f87171' : '#ec4899',
                    fontWeight: 600
                }}>
                    <span>{isUnlimited ? '∞' : profilePending ? '…' : `${dineBalance}`}</span>
                    <span style={{ opacity: 0.85, fontWeight: 400 }}>
                        {isUnlimited
                            ? t('unlimited_date_invitations', 'Unlimited date invitations')
                            : t(
                                  'dine_credits_dating_banner',
                                  '{{balance}} Dine Credits — publishing uses {{cost}} credits.',
                                  { balance: dineBalance, cost: publishCost }
                              )}
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

                    {/* Message — directly under title */}
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

                    {/* Card + cover: one preview row; thumbnails only on the right (template / upload / camera) */}
                    <div className="private-section-card private-section-card--templates mb-4" style={{ borderColor: 'rgba(236,72,153,0.25)' }}>
                        <h3 className="private-section-card__title" style={{ color: '#ec4899' }}>
                            <span aria-hidden>🃏</span>{' '}
                            {t('private_section_templates_title', { defaultValue: 'Ready card looks' })}
                        </h3>
                        <p className="private-section-card__hint">
                            {t('dating_section_templates_hint', {
                                defaultValue: 'Camera, upload, or template — thumbnails beside the card.'
                            })}
                        </p>
                        <div
                            role="tablist"
                            aria-label={t('dating_cover_tabs_label', { defaultValue: 'Cover source' })}
                            style={{ display: 'flex', gap: 8, marginBottom: 14 }}
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'camera'}
                                onClick={() => handleDatingCoverTab('camera')}
                                style={datingCoverTabBtnStyle(datingCoverTab === 'camera')}
                            >
                                <FaCamera /> {t('dating_cover_tab_camera', { defaultValue: 'Camera' })}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'upload'}
                                onClick={() => handleDatingCoverTab('upload')}
                                style={datingCoverTabBtnStyle(datingCoverTab === 'upload')}
                            >
                                <FaUpload /> {t('dating_cover_tab_upload', { defaultValue: 'Upload' })}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'template'}
                                onClick={() => handleDatingCoverTab('template')}
                                style={datingCoverTabBtnStyle(datingCoverTab === 'template')}
                            >
                                <FaImage /> {t('dating_cover_tab_template', { defaultValue: 'Template' })}
                            </button>
                        </div>

                        {datingCoverTab === 'camera' && (
                            <DatingCoverCameraPanel
                                onMediaSelect={setCoverMedia}
                                openNonce={cameraOpenNonce}
                            />
                        )}

                        <div
                            className="dating-card-show-content-toggle"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '10px 12px',
                                marginBottom: 12,
                                borderRadius: 12,
                                border: '1px solid rgba(236,72,153,0.28)',
                                background: 'rgba(236,72,153,0.06)'
                            }}
                            title={t('dating_card_show_content_title', {
                                defaultValue: 'Off: title, date & place only on the card. On: include your message and profile photo.'
                            })}
                        >
                            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ec4899', lineHeight: 1.25 }}>
                                {t('dating_card_show_content_label', { defaultValue: 'Show message & profile on card' })}
                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={datingCardShowHostAndMessage}
                                aria-label={t('dating_card_show_content_label')}
                                onClick={() => setDatingCardShowHostAndMessage((v) => !v)}
                                style={{
                                    flexShrink: 0,
                                    width: 52,
                                    height: 30,
                                    borderRadius: 999,
                                    border: '2px solid rgba(236,72,153,0.45)',
                                    background: datingCardShowHostAndMessage ? 'linear-gradient(135deg,#ec4899,#be185d)' : 'rgba(0,0,0,0.2)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    padding: 0
                                }}
                            >
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: 3,
                                        insetInlineStart: datingCardShowHostAndMessage ? 24 : 3,
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
                                        transition: 'inset-inline-start 0.2s',
                                        display: 'block'
                                    }}
                                />
                            </button>
                        </div>

                        <div className="form-group mb-0">
                            <label className="elegant-label">
                                {t('private_card_preview_label', { defaultValue: 'Invitation card' })}
                            </label>
                            <PrivateCardMotionPicker value={cardMotionId} onChange={setCardMotionId} />
                            <div className="private-card-preview-with-bg">
                                <div className="private-card-preview-with-bg__preview-wrap">
                                    <PrivateInvitationCardPreview
                                        cardTemplateSet="dating"
                                        className="private-invitation-card-preview--showcase private-invitation-card-preview--showcase-compact"
                                        frameColorId={cardFrameColorId}
                                        cardThemeColor={datingCardThemeColor}
                                        cardFontId={cardFontId}
                                        cardMotionId={cardMotionId}
                                        occasionType={formData.occasionType}
                                        cardBackgroundId={cardBackgroundId}
                                        heroCoverSrc={datingHeroCover?.src ?? null}
                                        heroCoverMediaType={datingHeroCover?.mediaType ?? null}
                                        heroCoverPoster={datingHeroCover?.poster ?? null}
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
                                        showHostAndMessage={datingCardShowHostAndMessage}
                                    />
                                </div>
                                <DatingPreviewRightRail
                                    mode={datingCoverTab}
                                    cardBackgroundId={cardBackgroundId}
                                    onTemplateSelect={applyDatingTemplateCover}
                                    mediaData={mediaData}
                                    onMediaSelect={setCoverMedia}
                                />
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => setTypographySheetOpen(true)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: 12,
                                            border: '2px solid rgba(236,72,153,0.55)',
                                            background: 'rgba(236,72,153,0.12)',
                                            color: '#ec4899',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            touchAction: 'manipulation'
                                        }}
                                    >
                                        {t('dating_card_style_btn', { defaultValue: 'Font & card color' })}
                                    </button>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flex: '1 1 160px', minWidth: 0 }}>
                                        {datingFontSummary} · {datingCardColorSummary}
                                    </span>
                                </div>
                            </div>
                            <PrivateCardDatingTypographySheet
                                open={typographySheetOpen}
                                onClose={() => setTypographySheetOpen(false)}
                                fontId={cardFontId}
                                themeColorHex={datingCardThemeColor}
                                onFontChange={setCardFontId}
                                onThemeColorChange={setDatingCardThemeColor}
                            />
                        </div>
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
                                    const canReceiveDating = friend.availableForDating !== false;
                                    return (
                                        <div
                                            key={friend.id}
                                            onClick={() => {
                                                if (isDisabled || !canReceiveDating) return;
                                                toggleFriendSelection(friend.id);
                                            }}
                                            style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                padding: '10px 6px', borderRadius: 12,
                                                background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1.5px solid ${isSelected ? '#ec4899' : 'rgba(255,255,255,0.07)'}`,
                                                cursor: (isDisabled || !canReceiveDating) ? 'not-allowed' : 'pointer',
                                                opacity: (isDisabled || !canReceiveDating) ? 0.4 : 1,
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
                                            {!canReceiveDating && (
                                                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#fca5a5', textAlign: 'center' }}>
                                                    {t('dating_invites_reject', 'Reject')}
                                                </span>
                                            )}
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
