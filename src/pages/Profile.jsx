import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { FaCamera, FaChevronRight, FaPlus, FaTimes, FaUser, FaStore, FaChartLine, FaGifts, FaEdit, FaSave, FaStar, FaCheckCircle, FaSignOutAlt, FaCog, FaBirthdayCake } from 'react-icons/fa';
import { HiUser } from 'react-icons/hi2';
import { uploadProfilePicture } from '../utils/imageUpload';
import ImageUpload from '../components/ImageUpload';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
// Profile Enhancements
import { StatisticsCards, Achievements } from '../components/ProfileEnhancements';
import { FavoritePlaces } from '../components/ProfileEnhancementsExtended';
import CreateInvitationSelector from '../components/CreateInvitationSelector';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';

const InvitationListItem = ({ inv, navigate, t }) => (
    <div
        onClick={() => navigate(inv.privacy === 'private' ? `/invitation/private/${inv.id}` : `/invitation/${inv.id}`)}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 10px',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            marginBottom: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'rgba(255, 255, 255, 0.02)'
        }}
    >
        <img
            src={inv.customImage || inv.restaurantImage || inv.videoThumbnail || inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'; }}
            style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
            alt={inv.title}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{inv.title}</h4>
                {inv.privacy === 'private' ? (
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(251, 191, 36, 0.2)', color: 'var(--luxury-gold)', border: '1px solid rgba(251, 191, 36, 0.3)', fontWeight: '900' }}>
                        {t('type_private')}
                    </span>
                ) : (
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)', color: 'var(--primary)', border: '1px solid rgba(139, 92, 246, 0.3)', fontWeight: '900' }}>
                        {t('type_public', 'Public')}
                    </span>
                )}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inv.date ? inv.date.split('T')[0] : 'Today'}</span>
        </div>
        <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
    </div>
);

const Profile = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, updateProfile, invitations, restaurants, updateRestaurant, toggleFollow, deleteInvitation } = useInvitations();
    const { signOut, currentUser: firebaseUser, userProfile, loading } = useAuth();
    const { setActivePrivateInvitation } = useNotifications();
    const { isDark, toggleTheme } = useTheme();
    const [isEditing, setIsEditing] = useState(false);

    const [activeTab, setActiveTab] = useState('public');
    const [newInterest, setNewInterest] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Redirect guests to login - DISABLED this redirect because we want to show a guest-specific profile view
    // useEffect(() => {
    //     if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest') {
    //         navigate('/login');
    //     }
    // }, [userProfile, navigate]);

    // Redirect business accounts to business profile
    useEffect(() => {
        if (userProfile?.accountType === 'business') {
            navigate(`/partner/${currentUser.uid}`);
        }
    }, [userProfile, navigate]);

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
                phone: currentData.phone || ''
            });
        }

        // Fetch actual followers count
        const fetchRealFollowersCount = async () => {
            try {
                const q = query(collection(db, 'users'), where('following', 'array-contains', currentUser.uid));
                const snapshot = await getDocs(q);
                setRealtimeUser(prev => ({ ...prev, followersCount: snapshot.size }));
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
                        phone: data.phone || ''
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
            navigate('/login');
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
    });

    const myPostedInvitations = invitations.filter(inv => inv.author?.id === currentUser.uid);
    const publicPosted = myPostedInvitations.filter(inv => inv.privacy !== 'private');
    const privatePosted = myPostedInvitations.filter(inv => inv.privacy === 'private');

    const receivedPrivate = invitations.filter(inv =>
        inv.privacy === 'private' &&
        inv.invitedFriends?.includes(currentUser.uid) &&
        inv.author?.id !== currentUser.uid
    );

    const myJoinedInvitations = invitations.filter(inv => inv.joined?.includes(currentUser.uid));

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
        // Validate mandatory fields
        if (!formData.gender) {
            alert(i18n.language === 'ar'
                ? t('please_select_gender')
                : '⚠️ Please select your gender');
            return;
        }

        if (!formData.ageCategory && !formData.age) {
            alert(i18n.language === 'ar'
                ? t('please_enter_age')
                : '⚠️ Please select your age category');
            return;
        }

        // Check for external links in bio
        if (containsExternalLinks(formData.bio)) {
            alert(i18n.language === 'ar'
                ? t('no_external_links')
                : '⚠️ External links and social media accounts are not allowed in profile');
            return;
        }

        setIsSaving(true);
        setUploadProgress(0);

        try {
            let finalAvatar = formData.avatar;

            // Upload new avatar if selected
            if (avatarFile) {
                const url = await uploadProfilePicture(
                    avatarFile,
                    firebaseUser.uid,
                    (progress) => setUploadProgress(progress)
                );
                finalAvatar = url;
            }


            await updateProfile({ ...formData, avatar: finalAvatar });
            setIsEditing(false);
            setAvatarFile(null);
            setUploadProgress(0);
        } catch (e) {
            console.error(e);
            alert(i18n.language === 'ar'
                ? t('failed_save_profile')
                : 'Failed to save profile'
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="profile-page" style={{ paddingBottom: '100px' }}>


            <div style={{ padding: '0 1rem 1rem' }}>

                <div className="personal-view">
                    {/* Theme Toggle Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 0' }}>
                        <button
                            onClick={toggleTheme}
                            style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                color: isDark ? 'var(--luxury-gold)' : 'var(--primary)',
                                width: '38px',
                                height: '38px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                        >
                            {isDark ? <FaSun /> : <FaMoon />}
                        </button>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'inline-block', position: 'relative' }}>
                            {isEditing ? (
                                <ImageUpload
                                    currentImage={getSafeAvatar(formData)}
                                    onImageSelect={setAvatarFile}
                                    shape="circle"
                                    size="large"
                                    label={t('change_photo')}
                                />
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <div
                                        className="host-avatar-container"
                                        style={{
                                            width: '100px',
                                            height: '100px',
                                            margin: '0 auto',
                                            border: `3px solid var(--primary)`,
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
                                    {userProfile?.accountType !== 'guest' && !userProfile?.isGuest && (
                                        <button
                                            onClick={() => navigate('/create-story')}
                                            style={{
                                                position: 'absolute',
                                                bottom: '5px',
                                                right: '5px',
                                                background: '#ef4444',
                                                color: 'white',
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '3px solid var(--bg-body)',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                            }}
                                            title="Add Story"
                                        >
                                            <FaPlus size={12} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Upload Progress */}
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
                        </div>

                        {isEditing ? (
                            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textAlign: 'center' }}>{t('profile_name')}</label>
                                    <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: '900' }} />
                                </div>

                                {/* Gender Selection - Required */}
                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                                        {t('gender')} <span style={{ color: 'var(--secondary)' }}>*</span>
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, gender: 'male' })}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '12px',
                                                border: formData.gender === 'male' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: formData.gender === 'male' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                                color: 'var(--text-main)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s',
                                                fontWeight: '700'
                                            }}
                                        >
                                            <span>👨</span>
                                            <span>{t('male')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, gender: 'female' })}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '12px',
                                                border: formData.gender === 'female' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: formData.gender === 'female' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                                color: 'var(--text-main)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s',
                                                fontWeight: '700'
                                            }}
                                        >
                                            <span>👩</span>
                                            <span>{t('female')}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Age Category Selection - Standardized */}
                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                                        {t('age_category', { defaultValue: 'Age Category' })} <span style={{ color: 'var(--secondary)' }}>*</span>
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        {[
                                            { value: '18-24', label: '18-24' },
                                            { value: '25-34', label: '25-34' },
                                            { value: '35-44', label: '35-44' },
                                            { value: '45-54', label: '45-54' },
                                            { value: '55+', label: '55+' }
                                        ].map((option) => {
                                            const isSelected = formData.ageCategory === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, ageCategory: option.value })}
                                                    style={{
                                                        position: 'relative',
                                                        padding: '12px 8px',
                                                        borderRadius: '12px',
                                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                        background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--hover-overlay)',
                                                        color: isSelected ? 'white' : 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        transform: isSelected ? 'translateY(-2px)' : 'none',
                                                        boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
                                                        minHeight: '60px'
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <div style={{ position: 'absolute', top: '5px', right: '5px', color: 'var(--primary)', fontSize: '0.6rem' }}>
                                                            <FaCheckCircle />
                                                        </div>
                                                    )}
                                                    <HiUser style={{
                                                        fontSize: '1.2rem',
                                                        color: isSelected ? 'var(--primary)' : 'inherit',
                                                        marginBottom: '2px',
                                                        filter: isSelected ? 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.5))' : 'none'
                                                    }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? '800' : '600' }}>
                                                        {option.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textAlign: 'center' }}>{t('profile_bio')}</label>
                                    <textarea className="input-field" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder={t('profile_bio_placeholder')} style={{ textAlign: 'center', fontSize: '0.9rem', minHeight: '80px' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={handleSave} disabled={isSaving} className="btn btn-primary" style={{ flex: 1 }}>
                                        {isSaving ? t('saving') : t('save_btn')}
                                    </button>
                                    <button onClick={() => setIsEditing(false)} disabled={isSaving} className="btn btn-outline" style={{ flex: 1 }}>{t('cancel_btn')}</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 style={{ fontSize: '1.6rem', fontWeight: '900', marginTop: '0.75rem', marginBottom: '0.15rem' }}>{realtimeUser.name}</h1>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>{realtimeUser.bio || t('active_member')}</p>
                                {/* Display Gender and Age */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <div style={{
                                        background: 'rgba(139, 92, 246, 0.15)',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(139, 92, 246, 0.3)',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
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
                                        background: 'rgba(251, 191, 36, 0.15)',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(251, 191, 36, 0.3)',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        color: 'var(--luxury-gold)',
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

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginBottom: '1rem', marginTop: '0.5rem' }}>
                            <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/followers', { state: { activeTab: 'followers' } })}>
                                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)' }}>{realtimeUser.followersCount || 0}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('followers')}</div>
                            </div>
                            <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                            <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/followers', { state: { activeTab: 'following' } })}>
                                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)' }}>{realtimeUser.following?.length || 0}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('following')}</div>
                            </div>
                        </div>

                        {/* Subscription & Credits Section */}
                        {userProfile?.accountType !== 'guest' && !userProfile?.isGuest && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(251, 191, 36, 0.04))',
                                borderRadius: '14px',
                                padding: '12px',
                                marginBottom: '1rem',
                                border: '1px solid rgba(139, 92, 246, 0.15)',
                                textAlign: 'right'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{
                                        background: 'var(--primary)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: '800'
                                    }}>
                                        {userProfile?.accountType === 'admin' ? 'ADMIN' : (userProfile?.subscriptionPlan?.toUpperCase() || 'FREE')}
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                        Subscription Plan
                                    </span>
                                </div>

                                {/* Hide Invitation Quotas for Business Accounts */}
                                {userProfile?.accountType !== 'business' && (
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{
                                            flex: 1,
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            padding: '10px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255, 255, 255, 0.1)'
                                        }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                Private Invites Left
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--luxury-gold)' }}>
                                                {userProfile?.weeklyPrivateQuota === -1 ? '∞' :
                                                    (userProfile?.weeklyPrivateQuota || 0) - (userProfile?.usedPrivateCreditsThisWeek || 0)}
                                            </div>
                                            {userProfile?.lastQuotaResetDate && (
                                                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    Resets on: {(() => {
                                                        const timestamp = userProfile.lastQuotaResetDate;
                                                        const lastReset = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date());
                                                        const nextReset = new Date(lastReset.getTime() + 7 * 24 * 60 * 60 * 1000);
                                                        return nextReset.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            padding: '10px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255, 255, 255, 0.1)'
                                        }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                Extra Credits
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {userProfile?.purchasedPrivateCredits || 0}
                                                {userProfile?.purchasedPrivateCredits === 5 && (
                                                    <span style={{ fontSize: '0.65rem', background: '#48bb78', color: 'white', padding: '1px 6px', borderRadius: '8px', verticalAlign: 'middle' }}>
                                                        GIFT 🎁
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => navigate('/pricing')}
                                                style={{
                                                    marginTop: '8px',
                                                    background: 'transparent',
                                                    border: '1px solid var(--primary)',
                                                    color: 'var(--primary)',
                                                    fontSize: '0.65rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                + Top Up
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {userProfile?.trialExpiry && new Date(userProfile.trialExpiry.seconds * 1000) > new Date() && (
                                    <div style={{
                                        marginTop: '12px',
                                        background: 'rgba(72, 187, 120, 0.1)',
                                        borderRadius: '10px',
                                        padding: '8px 12px',
                                        fontSize: '0.8rem',
                                        color: '#48bb78',
                                        fontWeight: '700',
                                        textAlign: 'center',
                                        border: '1px dashed #48bb78'
                                    }}>
                                        ✨ Trial Pro Plan Active - Ends: {new Date(userProfile.trialExpiry.seconds * 1000).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </div>
                                )}

                                {(!userProfile?.subscriptionPlan || userProfile?.subscriptionPlan === 'free') && (
                                    <button
                                        onClick={() => navigate('/pricing')}
                                        style={{
                                            width: '100%',
                                            marginTop: '12px',
                                            padding: '10px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '0.85rem',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                                        }}
                                    >
                                        Upgrade Plan
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Profile Actions: Edit & Create Invitation - Hide for Guests */}
                        {!isEditing && userProfile?.accountType !== 'guest' && !userProfile?.isGuest && (
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-main)',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        fontWeight: '700',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('edit_profile') || 'Edit Profile'}
                                </button>
                                {userProfile?.accountType !== 'business' && (
                                    <button
                                        onClick={() => setIsSelectorOpen(true)}
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            background: 'linear-gradient(135deg, var(--primary), #eab308)', // Gold
                                            border: 'none',
                                            color: 'white',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            fontWeight: '700',
                                            fontSize: '0.85rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <FaPlus /> {t('create_invitation', 'Create Invitation')}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Guest Mode Login Prompt */}
                        {(userProfile?.accountType === 'guest' || userProfile?.isGuest) && (
                            <div style={{
                                padding: '1.5rem',
                                background: 'rgba(139, 92, 246, 0.1)',
                                borderRadius: '16px',
                                border: '1px dashed var(--primary)',
                                textAlign: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-white)' }}>
                                    {t('guest_welcome_title', { defaultValue: 'Join DineBuddies' })}
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    {t('guest_profile_desc', { defaultValue: 'Create an account to customize your profile and join events.' })}
                                </p>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '12px' }}
                                >
                                    {t('login_signup')}
                                </button>
                            </div>
                        )}
                    </div>


                    {/* Plan & Subscription Card - Only show if user has active subscription */}
                    {userProfile?.subscription?.status === 'active' && (
                        <div className="premium-plan-card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: 'var(--luxury-gold)', borderRadius: '50%', filter: 'blur(30px)', opacity: 0.2 }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>💳</span> {t('my_plan')}
                                </h3>
                                <span style={{ background: 'rgba(251, 191, 36, 0.2)', color: 'var(--luxury-gold)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
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
                                onClick={() => navigate('/plans')}
                                style={{
                                    width: '100%',
                                    marginTop: '1rem',
                                    padding: '12px',
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {t('manage_subscription')}
                            </button>
                        </div>
                    )}

                    {/* 📊 STATISTICS CARDS */}
                    <StatisticsCards userId={currentUser?.uid || currentUser?.id} />

                    {/* 🏆 ACHIEVEMENTS */}
                    <Achievements userId={currentUser?.uid || currentUser?.id} />

                    {/* 📍 FAVORITE PLACES */}
                    <FavoritePlaces userId={currentUser?.uid || currentUser?.id} />



                    <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
                            <style>{`
                                .profile-tab-btn {
                                    flex: 1;
                                    padding: 12px 8px;
                                    border: none;
                                    background: transparent;
                                    color: var(--text-muted);
                                    font-weight: 800;
                                    font-size: 0.85rem;
                                    transition: all 0.2s;
                                    border-bottom: 3px solid transparent;
                                    white-space: nowrap;
                                }
                                .profile-tab-btn.active {
                                    color: var(--primary);
                                    border-bottom-color: var(--primary);
                                }
                            `}</style>
                            <button
                                onClick={() => setActiveTab('public')}
                                className={`profile-tab-btn ${activeTab === 'public' ? 'active' : ''}`}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span>{t('stats_public')}</span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({publicPosted.length})</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('private')}
                                className={`profile-tab-btn ${activeTab === 'private' ? 'active' : ''}`}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span>{t('stats_private')}</span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({privatePosted.length + receivedPrivate.length})</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('joined')}
                                className={`profile-tab-btn ${activeTab === 'joined' ? 'active' : ''}`}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span>{t('stats_joined')}</span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({myJoinedInvitations.length})</span>
                                </div>
                            </button>
                        </div>

                        <div style={{ minHeight: '100px' }}>
                            {activeTab === 'private' && (
                                <>
                                    {/* My Private Posts */}
                                    {privatePosted.length > 0 && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 5px' }}>
                                                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                                    {t('my_private_posts', 'My Private Posts')}
                                                </h4>
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm(t('confirm_delete_all_private', 'Are you sure you want to delete all your private invitations?'))) {
                                                            for (const inv of privatePosted) {
                                                                await deleteInvitation(inv.id);
                                                            }
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        borderRadius: '8px',
                                                        padding: '4px 10px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '700',
                                                        cursor: 'pointer'
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
                                            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', marginLeft: '5px' }}>
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
                </div>
            </div>

            {/* Invitation Type Selector Modal */}
            <CreateInvitationSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
            />
        </div>
    );
};

export default Profile;
