import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { FaCamera, FaChevronRight, FaPlus, FaTimes, FaUser, FaStore, FaChartLine, FaGifts, FaEdit, FaSave, FaStar, FaCheckCircle, FaSignOutAlt, FaCog } from 'react-icons/fa';
import { uploadProfilePicture } from '../utils/imageUpload';
import ImageUpload from '../components/ImageUpload';

const Profile = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, updateProfile, invitations, restaurants, updateRestaurant, toggleFollow } = useInvitations();
    const { signOut, currentUser: firebaseUser, userProfile } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('posted');
    const [newInterest, setNewInterest] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Redirect business accounts to business profile
    useEffect(() => {
        if (userProfile?.accountType === 'business') {
            navigate('/business-profile');
        }
    }, [userProfile, navigate]);

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
        name: currentUser.name,
        bio: currentUser.bio || '',
        avatar: currentUser.avatar,
        interests: currentUser.interests || [],
        gender: currentUser.gender || 'male', // Required: 'male' or 'female'
        age: currentUser.age || 18 // Required: minimum 18
    });

    const myPostedInvitations = invitations.filter(inv => inv.author?.id === currentUser.id);
    const myJoinedInvitations = invitations.filter(inv => inv.joined?.includes(currentUser.id));

    // Validate for external links
    const containsExternalLinks = (text) => {
        const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
        return urlPattern.test(text);
    };

    const handleSave = async () => {
        // Validate mandatory fields
        if (!formData.gender) {
            alert(i18n.language === 'ar'
                ? t('please_select_gender')
                : '⚠️ Please select your gender');
            return;
        }

        if (!formData.age || formData.age < 18) {
            alert(i18n.language === 'ar'
                ? t('please_enter_age')
                : '⚠️ Please enter your age (minimum 18 years)');
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
        <div className="profile-page" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Settings Button */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'var(--bg-body)',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'flex-end'
            }}>
                <button
                    onClick={() => navigate('/settings')}
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'white',
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-card)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <FaCog />
                </button>
            </div>

            <div style={{ padding: '0 1.5rem 2rem' }}>

                <div className="personal-view">
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ display: 'inline-block', position: 'relative' }}>
                            {isEditing ? (
                                <ImageUpload
                                    currentImage={formData.avatar}
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
                                            width: '130px',
                                            height: '130px',
                                            margin: '0 auto',
                                            border: `4px solid var(--primary)`,
                                            position: 'relative'
                                        }}
                                    >
                                        <img src={formData.avatar} alt={formData.name} className="host-avatar" />
                                    </div>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        style={{
                                            position: 'absolute',
                                            bottom: '0',
                                            right: '0',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            width: '35px',
                                            height: '35px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '3px solid var(--bg-body)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <FaEdit size={14} style={{ margin: 'auto' }} />
                                    </button>
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
                                                color: 'white',
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
                                                color: 'white',
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

                                {/* Age Input - Required */}
                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textAlign: 'center' }}>
                                        {t('age')} <span style={{ color: 'var(--secondary)' }}>*</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={formData.age}
                                        onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 18 })}
                                        min="18"
                                        max="100"
                                        style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: '700' }}
                                        placeholder="18"
                                    />
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '5px' }}>
                                        {t('minimum_age_18')}
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
                                <h1 style={{ fontSize: '2rem', fontWeight: '900', marginTop: '1rem', marginBottom: '0.25rem' }}>{currentUser.name}</h1>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{currentUser.bio || t('active_member')}</p>
                                {/* Display Gender and Age */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '1.5rem' }}>
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
                                        <span>{currentUser.gender === 'male' ? '👨' : '👩'}</span>
                                        <span>{currentUser.gender === 'male' ? t('male') : t('female')}</span>
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
                                        <span>{currentUser.age} {t('years')}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem', marginTop: '1.5rem' }}>
                            <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/followers')}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>{currentUser.followersCount || 0}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('followers')}</div>
                            </div>
                            <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                            <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/followers')}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>{currentUser.following?.length || 0}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('following')}</div>
                            </div>
                        </div>
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

                    <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto' }}>
                            <button onClick={() => setActiveTab('posted')} style={{ flex: 1, padding: '15px', border: 'none', background: 'transparent', color: activeTab === 'posted' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'posted' ? '3px solid var(--primary)' : 'none', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                {t('stats_posted')} ({myPostedInvitations.length})
                            </button>
                            <button onClick={() => setActiveTab('joined')} style={{ flex: 1, padding: '15px', border: 'none', background: 'transparent', color: activeTab === 'joined' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'joined' ? '3px solid var(--primary)' : 'none', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                {t('stats_joined')} ({myJoinedInvitations.length})
                            </button>
                        </div>

                        <div style={{ minHeight: '100px' }}>
                            {/* Posted/Joined Invitations */}
                            {(activeTab === 'posted' || activeTab === 'joined') && (activeTab === 'posted' ? myPostedInvitations : myJoinedInvitations).map(inv => (
                                <div key={inv.id} onClick={() => navigate(`/invitation/${inv.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '15px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.2s', ':hover': { background: 'rgba(139, 92, 246, 0.1)' } }}>
                                    <img
                                        src={inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
                                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'; }}
                                        style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                                        alt={inv.title}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.title}</h4>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inv.date ? inv.date.split('T')[0] : 'Today'}</span>
                                    </div>
                                    <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
                                </div>
                            ))}

                            {(activeTab === 'posted' ? myPostedInvitations : myJoinedInvitations).length === 0 && (activeTab === 'posted' || activeTab === 'joined') && (
                                <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {t('nothing_to_show')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Language Selector */}
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.3rem' }}>🌍</span>
                            {t('language_selector')}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {[
                                { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
                                { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
                                { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
                                { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
                                { code: 'ur', name: 'اردو', flag: '🇵🇰', dir: 'rtl' },
                                { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' }
                            ].map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => i18n.changeLanguage(lang.code)}
                                    style={{
                                        padding: '12px',
                                        background: i18n.language === lang.code ? 'var(--primary)' : 'transparent',
                                        border: `2px solid ${i18n.language === lang.code ? 'var(--primary)' : 'var(--border-color)'}`,
                                        borderRadius: '12px',
                                        color: i18n.language === lang.code ? 'white' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: '700',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{lang.flag}</span>
                                    <span>{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>



                    {/* Demo Account Switcher - For Testing Only (Hidden if real user logged in) */}

                </div>

            </div>
        </div >
    );
};

export default Profile;
