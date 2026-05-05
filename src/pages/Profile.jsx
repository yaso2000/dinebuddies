import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FaChevronRight, FaTimes, FaUser, FaStore, FaChartLine, FaGifts, FaEdit, FaSave, FaStar, FaCheckCircle, FaSignOutAlt, FaCog, FaBirthdayCake, FaHeart, FaBan, FaQuestionCircle } from 'react-icons/fa';
import { uploadProfilePicture } from '../utils/imageUpload';
import { getFollowersCount } from '../utils/followHelpers';
import ImageUpload from '../components/ImageUpload';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
// Profile Enhancements
import { StatisticsCards, Achievements } from '../components/ProfileEnhancements';
import { FavoritePlaces } from '../components/ProfileEnhancementsExtended';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import { goToLogin } from '../utils/goToLogin';

const InvitationListItem = ({ inv, navigate, t }) => (
    <div
        className="profile-invitation-item"
        onClick={() => navigate(inv.privacy === 'private' ? `/invitation/private/${inv.id}` : `/invitation/${inv.id}`)}
    >
        <img
            className="profile-invitation-item__thumb"
            src={inv.customImage || inv.restaurantImage || inv.videoThumbnail || inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'; }}
            alt={inv.title}
        />
        <div className="profile-invitation-item__content">
            <div className="profile-invitation-item__title-row">
                <h4 className="profile-invitation-item__title">{inv.title}</h4>
                {inv.privacy === 'private' ? (
                    <span className="profile-invitation-item__badge profile-invitation-item__badge--private">{t('type_private')}</span>
                ) : (
                    <span className="profile-invitation-item__badge profile-invitation-item__badge--public">{t('type_public', 'Public')}</span>
                )}
            </div>
            <span className="profile-invitation-item__date">{inv.date ? inv.date.split('T')[0] : 'Today'}</span>
        </div>
        <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
    </div>
);

const Profile = () => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { currentUser, updateProfile, invitations, privateInvitations, restaurants, updateRestaurant, toggleFollow, deleteInvitation } = useInvitations();
    const { signOut, userProfile, loading } = useAuth();
    const { setActivePrivateInvitation } = useNotifications();
    const { isDark, toggleTheme } = useTheme();
    const [isEditing, setIsEditing] = useState(false);

    const [activeTab, setActiveTab] = useState('public');
    const [isSaving, setIsSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const isOwnProfile = true;

    // Redirect guests to login - DISABLED this redirect because we want to show a guest-specific profile view
    // useEffect(() => {
    //     if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest') {
    //         goToLogin();
    //     }
    // }, [userProfile, navigate]);

    // Redirect business accounts to business profile (wait for uid; replace to avoid history junk)
    useEffect(() => {
        if (!userProfile?.isBusiness || !currentUser?.uid) return;
        navigate(`/business/${currentUser.uid}`, { replace: true });
    }, [userProfile?.isBusiness, currentUser?.uid, navigate]);

    // Real-time listener for user profile updates (stats, etc.)
    const [realtimeUser, setRealtimeUser] = useState(userProfile || currentUser);

    useEffect(() => {
        if (!currentUser?.uid) return;

        // Use userProfile (from AuthContext) which is already normalized
        const currentData = userProfile || currentUser;

        setRealtimeUser(currentData);

        // Only update formData if not currently editing (to avoid losing unsaved changes)
        if (!isEditing) {
            setFormData({
                name: currentData.display_name || currentData.displayName || currentData.name || '',
                bio: currentData.bio || '',
                avatar: getSafeAvatar(currentData),
                interests: currentData.interests || [],
                gender: currentData.gender || 'male',
                age: currentData.age || 25,
                ageCategory: currentData.ageCategory || '',
                phone: currentData.phone || '',
                availableForDating: currentData.availableForDating !== false
            });
        }

        // Fetch actual followers count
        const fetchRealFollowersCount = async () => {
            try {
                const count = await getFollowersCount(currentUser.uid);
                setRealtimeUser(prev => ({ ...prev, followersCount: count }));
            } catch (error) {
                console.error("Error fetching followers count:", error);
            }
        };

        fetchRealFollowersCount();

        // The real-time updates are now handled by AuthContext, 
        // but we still listen here if we want immediate UI feedback beyond the context
        const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = { id: docSnapshot.id, ...docSnapshot.data() };

                setRealtimeUser(prev => ({
                    ...prev,
                    ...data,
                    followersCount: prev.followersCount, // Keep our calculated count
                    avatar: getSafeAvatar(data)
                }));

                if (!isEditing) {
                    setFormData(prev => ({
                        ...prev,
                        avatar: getSafeAvatar(data),
                        name: data.display_name || data.displayName || data.name || '',
                        bio: data.bio || '',
                        gender: data.gender || 'male',
                        age: data.age || 25,
                        ageCategory: data.ageCategory || '',
                        phone: data.phone || '',
                        availableForDating: data.availableForDating !== false
                    }));
                }
            }
        });

        return () => unsub();
    }, [currentUser?.uid, isEditing, userProfile]);

    // Logout handler
    const handleLogout = async () => {
        try {
            await signOut();
            goToLogin();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };



    const [formData, setFormData] = useState({
        name: userProfile?.display_name || userProfile?.displayName || currentUser?.name || currentUser?.displayName || '',
        bio: userProfile?.bio || '',
        avatar: getSafeAvatar(userProfile || currentUser),
        interests: userProfile?.interests || [],
        gender: userProfile?.gender || 'male',
        age: userProfile?.age || 18,
        ageCategory: userProfile?.ageCategory || '',
        availableForDating: userProfile?.availableForDating !== false,
    });

    const profileUid = currentUser?.uid || currentUser?.id;

    const myPostedInvitations = invitations.filter((inv) => inv.author?.id === profileUid);
    const publicPosted = myPostedInvitations.filter((inv) => inv.privacy !== 'private');

    /** Legacy rows stored in `invitations` with privacy === private */
    const privatePostedLegacy = myPostedInvitations.filter((inv) => inv.privacy === 'private');
    /** Hosted private invites live in `private_invitations`; merge without duplicate ids */
    const hostedFromPrivateColl = (privateInvitations || [])
        .filter((inv) => (inv.authorId || inv.author?.id) === profileUid)
        .map((inv) => ({ ...inv, privacy: 'private' }));
    const legacyPrivateIds = new Set(privatePostedLegacy.map((i) => i.id));
    const privatePosted = [
        ...privatePostedLegacy,
        ...hostedFromPrivateColl.filter((inv) => !legacyPrivateIds.has(inv.id))
    ];

    const receivedPrivate = (privateInvitations || [])
        .filter(
            (inv) =>
                Array.isArray(inv.invitedFriends) &&
                inv.invitedFriends.includes(profileUid) &&
                (inv.authorId || inv.author?.id) !== profileUid
        )
        .map((inv) => ({ ...inv, privacy: 'private' }));

    const myJoinedInvitations = invitations.filter((inv) => inv.joined?.includes(profileUid));

    // Loading State
    if (loading || !userProfile || !realtimeUser) {
        return (
            <div className="page-container" style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                background: 'var(--bg-body)',
                padding: '2rem',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="loader-ring"></div>
                <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('loading_profile', 'Loading Profile...')}
                </p>
            </div>
        );
    }

    const currentProfileView = realtimeUser || userProfile;

    // Validate for external links
    const containsExternalLinks = (text) => {
        const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
        return urlPattern.test(text);
    };



    const getActiveList = () => {
        switch (activeTab) {
            case 'public': return publicPosted;
            case 'private': return [...privatePosted, ...receivedPrivate];
            case 'joined': return myJoinedInvitations;
            default: return [];
        }
    };

    const activeList = getActiveList();

    const handleSave = async () => {
        const trimmedName = (formData.name || '').trim();
        if (!trimmedName) {
            showToast(i18n.language === 'ar'
                ? t('please_enter_name', { defaultValue: 'يرجى إدخال الاسم' })
                : 'Please enter your name', 'error');
            return;
        }

        if (containsExternalLinks(formData.bio)) {
            showToast(i18n.language === 'ar'
                ? t('no_external_links')
                : '⚠️ External links and social media accounts are not allowed in profile', 'error');
            return;
        }

        setIsSaving(true);
        setUploadProgress(0);

        try {
            let finalAvatar = formData.avatar;
            if (avatarFile && currentUser?.uid) {
                finalAvatar = await uploadProfilePicture(
                    avatarFile,
                    currentUser.uid,
                    (progress) => setUploadProgress(progress)
                );
            }

            await updateProfile({
                name: trimmedName,
                bio: formData.bio,
                availableForDating: formData.availableForDating,
                avatar: finalAvatar
            });
            setIsEditing(false);
            setAvatarFile(null);
            setUploadProgress(0);
        } catch (e) {
            console.error(e);
            showToast(i18n.language === 'ar'
                ? t('failed_save_profile')
                : 'Failed to save profile', 'error'
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="profile-shell profile-page">

            <div className="profile-content">

                <div className="personal-view">
                    {/* Theme Toggle Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0.5rem 0', gap: '10px' }}>
                        {/* Help & Support Button */}
                        {isOwnProfile && (
                            <button
                                className="profile-top-btn"
                                onClick={() => navigate('/support')}
                                title={t('faq.title', 'Help & Support')}
                                style={{
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                <FaQuestionCircle size={18} />
                            </button>
                        )}

                        {/* Settings Button */}
                        {isOwnProfile && (
                            <button
                                className="profile-top-btn"
                                onClick={() => navigate('/settings')}
                                title={t('settings')}
                                style={{
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                <FaCog size={18} />
                            </button>
                        )}

                        {/* Theme Toggle Button */}
                        <button onClick={toggleTheme} className="profile-theme-toggle" style={{ color: isDark ? 'var(--luxury-gold)' : 'var(--primary)', marginLeft: '4px' }}>
                            {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
                        </button>
                    </div>

                    <div className="profile-identity" style={{ marginBottom: 'var(--profile-stack-gap)' }}>
                        <div
                            className="profile-avatar-edit-row"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                flexWrap: 'wrap',
                                marginBottom: '0.5rem'
                            }}
                        >
                        <div style={{ display: 'inline-block', position: 'relative' }}>
                            {isEditing ? (
                                <>
                                    <ImageUpload
                                        currentImage={getSafeAvatar(formData)}
                                        onImageSelect={setAvatarFile}
                                        onImageRemove={() => setAvatarFile(null)}
                                        shape="circle"
                                        size="large"
                                        label={t('change_photo')}
                                    />
                                    {uploadProgress > 0 && uploadProgress < 100 && (
                                        <div style={{
                                            marginTop: '10px',
                                            background: 'var(--card-bg)',
                                            borderRadius: '10px',
                                            padding: '8px 12px',
                                            fontSize: '0.85rem'
                                        }}>
                                            <div style={{ marginBottom: '5px', color: 'var(--text-secondary)' }}>
                                                {t('uploading_progress')} {Math.round(uploadProgress)}%
                                            </div>
                                            <div style={{
                                                height: '4px',
                                                background: 'var(--border-color)',
                                                borderRadius: '2px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    background: 'var(--primary)',
                                                    width: `${uploadProgress}%`,
                                                    transition: 'width 0.3s'
                                                }} />
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div
                                    className="host-avatar-container"
                                    style={{
                                        width: '100px',
                                        height: '100px',
                                        margin: '0 auto',
                                        border: `3px solid ${(userProfile?.role === 'business' || realtimeUser?.role === 'business') ? 'var(--border-color)' : (realtimeUser?.gender === 'female' ? '#ec4899' : realtimeUser?.gender === 'male' ? '#3b82f6' : '#a855f7')}`,
                                        position: 'relative',
                                        background: 'var(--hover-overlay)'
                                    }}
                                >
                                    <img
                                        src={getSafeAvatar(realtimeUser)}
                                        alt={formData.name}
                                        className="host-avatar"
                                        onError={(e) => {
                                            if (!e.target.src.includes('ui-avatars.com')) {
                                                e.target.src = getSafeAvatar(null);
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {!isEditing && !userProfile?.isGuest && (
                            <button
                                type="button"
                                className="ui-btn ui-btn--secondary profile-edit-beside-avatar"
                                onClick={() => setIsEditing(true)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: 700,
                                    padding: '10px 16px',
                                    borderRadius: '12px',
                                    flexShrink: 0
                                }}
                            >
                                <FaEdit size={16} aria-hidden />
                                {t('edit_profile') || 'Edit Profile'}
                            </button>
                        )}
                        </div>

                        {isEditing ? (
                            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="ui-form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', textAlign: 'center' }}>{t('profile_name')}</label>
                                    <input type="text" className="ui-form-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: '900' }} />
                                </div>

                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '5px' }}>
                                        <label className="ui-form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{t('profile_bio')}</label>
                                        <span style={{ fontSize: '0.7rem', color: formData.bio?.length >= 150 ? 'var(--secondary)' : 'var(--text-muted)' }}>{formData.bio?.length || 0} / 150</span>
                                    </div>
                                    <textarea className="ui-form-field" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder={t('profile_bio_placeholder')} maxLength={150} style={{ textAlign: 'center', fontSize: '0.9rem', minHeight: '80px' }} />
                                </div>

                                <div
                                    className="form-group"
                                    style={{
                                        border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--border-color))',
                                        borderRadius: '14px',
                                        padding: '12px',
                                        background: 'color-mix(in srgb, var(--primary) 10%, var(--bg-card))'
                                    }}
                                >
                                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {t('dating_invitation_preference_title', 'Dating invitation preference')}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                            {t('dating_invitation_preference_desc', 'Control whether others can send you dating invitations.')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, availableForDating: true }))}
                                            style={{
                                                padding: '11px',
                                                borderRadius: '12px',
                                                border: formData.availableForDating ? '2px solid #16a34a' : '1px solid var(--border-color)',
                                                background: formData.availableForDating ? 'rgba(22,163,74,0.16)' : 'var(--bg-card)',
                                                color: formData.availableForDating ? 'var(--text-main)' : 'var(--text-muted)',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '7px'
                                            }}
                                        >
                                            <FaHeart color={formData.availableForDating ? '#ef4444' : 'currentColor'} />
                                            {t('dating_invites_accept', 'Accept')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, availableForDating: false }))}
                                            style={{
                                                padding: '11px',
                                                borderRadius: '12px',
                                                border: !formData.availableForDating ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                                background: !formData.availableForDating ? 'rgba(239,68,68,0.16)' : 'var(--bg-card)',
                                                color: !formData.availableForDating ? 'var(--text-main)' : 'var(--text-muted)',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '7px'
                                            }}
                                        >
                                            <FaBan color={!formData.availableForDating ? '#ef4444' : 'currentColor'} />
                                            {t('dating_invites_reject', 'Reject')}
                                        </button>
                                    </div>
                                </div>

                                <FavoritePlaces userId={currentUser?.uid || currentUser?.id} readOnly={false} />

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" className="ui-btn ui-btn--primary" onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>
                                        {isSaving ? t('saving') : t('save_btn')}
                                    </button>
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--ghost"
                                        onClick={() => {
                                            setAvatarFile(null);
                                            setUploadProgress(0);
                                            setIsEditing(false);
                                        }}
                                        disabled={isSaving}
                                        style={{ flex: 1 }}
                                    >
                                        {t('cancel_btn')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 style={{ fontSize: '1.6rem', fontWeight: '900', marginTop: '0.75rem', marginBottom: '0.15rem', color: 'var(--text-main)' }}>{realtimeUser.name}</h1>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>{realtimeUser.bio || t('active_member')}</p>
                                {/* Display Gender and Age */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <div style={{
                                        background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-card))',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid color-mix(in srgb, var(--primary) 28%, var(--border-color))',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        color: 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <span>{realtimeUser.gender === 'male' ? '👨' : (realtimeUser.gender === 'female' ? '👩' : '👤')}</span>
                                        <span>{
                                            realtimeUser.gender === 'male' ? t('male') :
                                                realtimeUser.gender === 'female' ? t('female') :
                                                    t('non_binary', { defaultValue: 'Other' })
                                        }</span>
                                    </div>
                                    <div style={{
                                        background: 'color-mix(in srgb, var(--stat-reviews) 14%, var(--bg-card))',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid color-mix(in srgb, var(--stat-reviews) 35%, var(--border-color))',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        color: 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <span>🎂</span>
                                        <span>{realtimeUser.ageCategory || (realtimeUser.age ? `${realtimeUser.age} ${t('years')}` : '')}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {!isEditing && (
                        <>
                        <div className="profile-stats" style={{ justifyContent: 'center', gap: '1.25rem', marginTop: '0.5rem' }}>
                            <div className="profile-stat-item" style={{ flex: 'none', cursor: 'pointer' }} onClick={() => navigate('/followers', { state: { activeTab: 'followers' } })}>
                                <div className="profile-stat-value">{realtimeUser.followersCount || 0}</div>
                                <div className="profile-stat-label">{t('followers')}</div>
                            </div>
                            <div className="profile-stats-divider" />
                            <div className="profile-stat-item" style={{ flex: 'none', cursor: 'pointer' }} onClick={() => navigate('/followers', { state: { activeTab: 'following' } })}>
                                <div className="profile-stat-value">{realtimeUser.following?.length || 0}</div>
                                <div className="profile-stat-label">{t('following')}</div>
                            </div>
                        </div>

                        {/* Subscription & Credits Section */}
                        {!userProfile?.isGuest && (
                            <div className="profile-subscription-card" style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{
                                        background: 'var(--primary)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: '800'
                                    }}>
                                        {userProfile?.role === 'admin'
                                            ? 'ADMIN'
                                            : userProfile?.role === 'business'
                                                ? (userProfile?.subscriptionTier || 'free').toUpperCase()
                                                : t('profile_standard_account', 'Standard')}
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                        {userProfile?.role === 'business'
                                            ? t('subscription_plan_label', 'Subscription plan')
                                            : t('credits_wallet_heading', 'Credits')}
                                    </span>
                                </div>

                                {!userProfile?.isBusiness && (
                                    <div className="profile-subscription-quota-card" style={{ width: '100%' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {t('dine_credits', 'Dine Credits')}
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)' }}>
                                            {Math.max(0, Number(userProfile?.freeCredits) || 0) +
                                                Math.max(0, Number(userProfile?.paidCredits) || 0)}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.35 }}>
                                            {t(
                                                'dine_credits_use_hint',
                                                'Used for private & date invites, AI, and boosts. Free pool is used first.'
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--ghost"
                                            onClick={() => navigate('/settings/credits')}
                                            style={{ marginTop: '8px', fontSize: '0.65rem', padding: '2px 8px' }}
                                        >
                                            {t('open_dine_credits_wallet', 'Wallet')}
                                        </button>
                                    </div>
                                )}

                                {userProfile?.trialExpiry && new Date(userProfile.trialExpiry.seconds * 1000) > new Date() && (
                                    <div className="profile-subscription-trial-banner">
                                        {t('trial_ends_label', '✨ Trial Pro Plan Active - Ends:')} {new Date(userProfile.trialExpiry.seconds * 1000).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </div>
                                )}

                                {userProfile?.role === 'business' &&
                                    (userProfile?.subscriptionTier || 'free') === 'free' && (
                                        <button onClick={() => navigate('/business/pricing')} className="profile-subscription-upgrade-btn">
                                            {t('upgrade_plan_btn', 'Upgrade plan')}
                                        </button>
                                    )}
                            </div>
                        )}

                        {/* Guest Mode Login Prompt */}
                        {(userProfile?.isGuest) && (
                            <div className="ui-prompt">
                                <h3 className="ui-prompt__title">{t('guest_welcome_title', { defaultValue: 'Join DineBuddies' })}</h3>
                                <p className="ui-prompt__desc">{t('guest_profile_desc', { defaultValue: 'Create an account to customize your profile and join events.' })}</p>
                                <button type="button" className="ui-btn ui-btn--primary" onClick={() => goToLogin()} style={{ width: '100%', padding: '12px' }}>
                                    {t('login_signup')}
                                </button>
                            </div>
                        )}
                        </>
                        )}
                    </div>


                    {/* Plan & Subscription Card - Only show if user has active subscription */}
                    {!isEditing && userProfile?.subscription?.status === 'active' && (
                        <div className="premium-plan-card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: 'var(--profile-stack-gap)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: 'var(--luxury-gold)', borderRadius: '50%', filter: 'blur(30px)', opacity: 0.2 }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>💳</span> {t('my_plan')}
                                </h3>
                                <span style={{ background: 'color-mix(in srgb, var(--stat-reviews) 18%, var(--bg-card))', color: 'var(--text-main)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900', border: '1px solid color-mix(in srgb, var(--stat-reviews) 35%, var(--border-color))' }}>
                                    {userProfile?.subscription?.planName || 'PREMIUM'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {userProfile?.subscription?.features?.map((feature, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                        <FaCheckCircle style={{ color: 'var(--primary)' }} />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--secondary"
                                onClick={() => navigate('/plans')}
                                style={{ width: '100%', marginTop: '1rem', padding: '12px', fontSize: '0.85rem' }}
                            >
                                {t('manage_subscription')}
                            </button>
                        </div>
                    )}

                    {!isEditing && (
                    <>
                    {/* 📊 STATISTICS CARDS */}
                    <StatisticsCards userId={currentUser?.uid || currentUser?.id} />

                    {/* 🏆 ACHIEVEMENTS */}
                    <Achievements userId={currentUser?.uid || currentUser?.id} />

                    {/* 📍 FAVORITE PLACES */}
                    <FavoritePlaces userId={currentUser?.uid || currentUser?.id} readOnly />



                    <div className="ui-card">
                        <div className="ui-card-header ui-tabs hide-scrollbar">
                            <button
                                type="button"
                                onClick={() => setActiveTab('public')}
                                className={`ui-tab ${activeTab === 'public' ? 'ui-tab--active' : ''}`}
                            >
                                <span>{t('stats_public')}</span>
                                <span className="profile-stat-label" style={{ opacity: 0.8 }}>({publicPosted.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('private')}
                                className={`ui-tab ${activeTab === 'private' ? 'ui-tab--active' : ''}`}
                            >
                                <span>{t('stats_private')}</span>
                                <span className="profile-stat-label" style={{ opacity: 0.8 }}>({privatePosted.length + receivedPrivate.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('joined')}
                                className={`ui-tab ${activeTab === 'joined' ? 'ui-tab--active' : ''}`}
                            >
                                <span>{t('stats_joined')}</span>
                                <span className="profile-stat-label" style={{ opacity: 0.8 }}>({myJoinedInvitations.length})</span>
                            </button>
                        </div>

                        <div className="profile-section-body">
                            {activeTab === 'private' && (
                                <>
                                    {/* My Private Posts */}
                                    {privatePosted.length > 0 && (
                                        <div style={{ marginBottom: 'var(--profile-stack-gap)' }}>
                                            <div className="profile-meta-row profile-meta-row--sm" style={{ padding: '0 5px' }}>
                                                <h4 className="profile-stat-label" style={{ margin: 0 }}>
                                                    {t('my_private_posts', 'My Private Posts')}
                                                </h4>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger-outline"
                                                    onClick={async () => {
                                                        if (window.confirm(t('confirm_delete_all_private', 'Are you sure you want to delete all your private invitations?'))) {
                                                            for (const inv of privatePosted) {
                                                                const inPrivateColl = (privateInvitations || []).some((p) => p.id === inv.id);
                                                                await deleteInvitation(inv.id, inPrivateColl);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {t('clear_all', 'Clear All')}
                                                </button>
                                            </div>
                                            {privatePosted.map(inv => (
                                                <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Received Private Invitations */}
                                    {receivedPrivate.length > 0 && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <h4 className="profile-stat-label" style={{ marginBottom: '10px', marginLeft: '5px' }}>
                                                {t('received_invitations')}
                                            </h4>
                                            {receivedPrivate.map(inv => (
                                                <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                                            ))}
                                        </div>
                                    )}

                                    {privatePosted.length === 0 && receivedPrivate.length === 0 && (
                                        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {t('nothing_to_show')}
                                        </p>
                                    )}
                                </>
                            )}

                            {activeTab !== 'private' && (
                                <>
                                    {activeList.map(inv => (
                                        <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                                    ))}

                                    {activeList.length === 0 && (
                                        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {t('nothing_to_show')}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    </>
                    )}
                </div>
            </div>

        </div>
    );
};

export default Profile;
