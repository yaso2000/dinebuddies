import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import NewReportModal from '../components/NewReportModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowRight, FaStar, FaUserFriends, FaCheckCircle, FaFlag, FaComment, FaChevronRight, FaBan, FaVolumeMute } from 'react-icons/fa';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import { getFollowers, getFollowing } from '../utils/followHelpers';
import UserAvatar from '../components/UserAvatar';
import { goToLogin } from '../utils/goToLogin';
import { asUidArray, toggleUserBlock, toggleUserMute } from '../utils/userSocialLists';
import { useToast } from '../context/ToastContext';

/** ~5 invitation rows visible in scroll area (see .user-profile-invitation-list-scroll max-height). */
const INVITATION_HISTORY_SCROLL_HINT_THRESHOLD = 5;

const InvitationListItem = ({ inv, navigate, t }) => (
    <div
        className="profile-invitation-item profile-invitation-item--lg"
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
            <span className="profile-invitation-item__date">{inv.date ? inv.date.split('T')[0] : t('soon')}</span>
        </div>
        <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
    </div>
);

const UserProfile = () => {
    const { t, i18n } = useTranslation();
    const { userId } = useParams();
    const navigate = useNavigate();
    const { invitations, currentUser, toggleFollow, submitReport } = useInvitations();
    const handleToggleFollow = (targetUserId, e) => {
        e.stopPropagation();
        if (currentUser?.isGuest || !currentUser) { goToLogin(); return; }
        // Optimistic UI update — toggle isFollowedByMe locally
        setNetworkUsers(prev => prev.map(u =>
            u.id === targetUserId ? { ...u, isFollowedByMe: !u.isFollowedByMe } : u
        ));
        toggleFollow(targetUserId);
    };
    const { userProfile } = useAuth();
    const { showToast } = useToast();
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [socialBusy, setSocialBusy] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('public');
    const [networkUsers, setNetworkUsers] = useState([]);
    const [networkLoading, setNetworkLoading] = useState(false);
    /** After blocking, keep showing this profile until the user navigates to another route (same userId mount). */
    const [stayOnProfileAfterBlock, setStayOnProfileAfterBlock] = useState(false);

    useEffect(() => {
        setStayOnProfileAfterBlock(false);
    }, [userId]);

    // Fetch user data from Firestore
    useEffect(() => {
        const fetchUser = async () => {
            if (!userId) return;

            // If it's the current user, redirect to /profile
            if (userId === currentUser?.id) {
                navigate('/profile');
                return;
            }

            try {
                console.log('🔍 Fetching user data for:', userId);
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = { id: userDoc.id, ...userDoc.data() };
                    
                    // SECURITY BLOCK: Prevent normal users/businesses from viewing admin profiles
                    if (userData.role === 'admin' && currentUser?.role !== 'admin') {
                        console.warn("Unauthorized access to admin profile blocked.");
                        setUser(null); // Pretend the user doesn't exist
                        setLoading(false);
                        return;
                    }

                    console.log('✅ User data loaded:', userData);
                    setUser(userData);
                } else {
                    console.log('❌ User not found in Firestore');
                    setUser(null);
                }
            } catch (error) {
                console.error('❌ Error fetching user:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [userId, currentUser, navigate]);

    // Fetch followers preview for this user
    useEffect(() => {
        if (!userId) return;
        const fetchNetwork = async () => {
            setNetworkLoading(true);
            try {
                const myFollowingIds = currentUser?.following || [];

                let followersData = [];
                try { followersData = await getFollowers(userId); } catch (e) {}

                const allNetwork = followersData.map(u => ({ 
                    ...u, 
                    isFollowedByMe: myFollowingIds.includes(u.id) 
                }));
                
                setNetworkUsers(allNetwork);
            } catch (e) {}
            setNetworkLoading(false);
        };
        fetchNetwork();
    }, [userId, currentUser]);

    // Loading state
    if (loading) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <p>{t('loading')}</p>
            </div>
        );
    }

    // If user not found
    if (!user) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t('user_not_found')}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary">
                    {t('nav_home')}
                </button>
            </div>
        );
    }

    const myUid = currentUser?.uid || currentUser?.id;
    const blockedIds = asUidArray(userProfile?.blockedUserIds);
    const mutedIds = asUidArray(userProfile?.mutedUserIds);
    const theirBlockedIds = asUidArray(user?.blockedUserIds);
    const theyBlockedMe = Boolean(myUid && theirBlockedIds.includes(myUid));
    const iBlockedThem = Boolean(myUid && blockedIds.includes(userId));
    const iMutedThem = Boolean(myUid && mutedIds.includes(userId));

    const isFollowing = currentUser?.following?.includes(userId);
    // Respect the target user's "Allow Following" privacy setting.
    // Defaults to true for users who haven't configured it yet.
    const canBeFollowed = user.privacySettings?.allowFollowing !== false;

    /** Public invitations only — private invites are stored in `private_invitations` and are visible only to the host on their own profile. */
    const publicInvitations = invitations.filter(
        (inv) => inv.author?.id === userId && inv.privacy !== 'private'
    );

    const joinedInvitations = invitations.filter(
        (inv) =>
            inv.joined?.includes(userId) &&
            (inv.privacy !== 'private' || inv.invitedFriends?.includes(currentUser?.id || currentUser?.uid))
    );

    const getActiveList = () => {
        switch (activeTab) {
            case 'public':
                return publicInvitations;
            case 'joined':
                return joinedInvitations;
            default:
                return publicInvitations;
        }
    };

    const activeList = getActiveList();

    const handleToggleMute = async () => {
        if (currentUser?.isGuest || !myUid) {
            goToLogin();
            return;
        }
        if (socialBusy) return;
        setSocialBusy(true);
        try {
            await toggleUserMute(myUid, userId, !iMutedThem);
            showToast(
                iMutedThem ? t('user_unmuted_toast', 'User unmuted.') : t('user_muted_toast', 'User muted for invitations and messages.'),
                'success'
            );
        } catch (e) {
            console.error(e);
            showToast(t('error_update_settings', 'Something went wrong.'), 'error');
        } finally {
            setSocialBusy(false);
        }
    };

    const handleToggleBlock = async () => {
        if (currentUser?.isGuest || !myUid) {
            goToLogin();
            return;
        }
        if (socialBusy) return;
        if (iBlockedThem) {
            setSocialBusy(true);
            try {
                await toggleUserBlock(myUid, userId, false);
                setStayOnProfileAfterBlock(false);
                showToast(t('user_unblocked_toast', 'User unblocked.'), 'success');
            } catch (e) {
                console.error(e);
                showToast(t('error_update_settings', 'Something went wrong.'), 'error');
            } finally {
                setSocialBusy(false);
            }
            return;
        }
        if (!window.confirm(t('block_user_confirm', 'Block this user? You will no longer see their profile, posts, or invitations.'))) {
            return;
        }
        setSocialBusy(true);
        try {
            await toggleUserBlock(myUid, userId, true);
            setStayOnProfileAfterBlock(true);
            showToast(t('user_blocked_stay_on_page_toast', 'User blocked. You can keep viewing this page until you leave.'), 'success');
        } catch (e) {
            console.error(e);
            showToast(t('error_update_settings', 'Something went wrong.'), 'error');
        } finally {
            setSocialBusy(false);
        }
    };

    if (myUid && !currentUser?.isGuest && theyBlockedMe) {
        return (
            <div className="profile-page" style={{ paddingBottom: '100px' }}>
                <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(25px)', padding: '0 1rem', marginBottom: '1rem' }}>
                    <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                        <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                    </button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '800' }}>{t('profile')}</h3>
                    </div>
                    <div style={{ width: '40px' }} />
                </header>
                <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('profile_unavailable_blocked_you', 'This profile is unavailable.')}</p>
                    <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>{t('nav_home')}</button>
                </div>
            </div>
        );
    }

    if (myUid && !currentUser?.isGuest && iBlockedThem && !stayOnProfileAfterBlock) {
        return (
            <div className="profile-page" style={{ paddingBottom: '100px' }}>
                <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(25px)', padding: '0 1rem', marginBottom: '1rem' }}>
                    <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                        <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                    </button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '800' }}>{t('profile')}</h3>
                    </div>
                    <div style={{ width: '40px' }} />
                </header>
                <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('you_blocked_this_user', 'You blocked this user.')}</p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={socialBusy}
                        onClick={handleToggleBlock}
                    >
                        {t('unblock_user', 'Unblock')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page" style={{ paddingBottom: '100px' }}>
            {/* Header with Back Button */}
            <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(25px)', padding: '0 1rem', marginBottom: '1rem' }}>
                <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800' }}>
                        {t('profile')}
                    </h3>
                </div>
                <div style={{ width: '40px' }}></div>
            </header>

            <div style={{ padding: '2rem 1.5rem' }}>
                {/* Profile Header */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <div
                            className="host-avatar-container"
                            style={{
                                width: '130px',
                                height: '130px',
                                margin: '0 auto',
                                border: `4px solid ${getGenderBorderColor(user)}`,
                                position: 'relative',
                                background: 'var(--hover-overlay)'
                            }}
                        >
                            <img
                                src={getSafeAvatar(user)}
                                alt={user.name || user.display_name || 'User'}
                                className="host-avatar"
                                onError={(e) => {
                                    if (!e.target.src.includes('ui-avatars.com')) {
                                        e.target.src = getSafeAvatar(null);
                                    }
                                }}
                            />
                            {user.isOnline && <div className="host-status-online"></div>}
                        </div>

                    </div>

                    <h1 style={{ fontSize: '2rem', fontWeight: '900', marginTop: '1rem', marginBottom: '0.5rem' }}>
                        {user.name || user.display_name || t('dinebuddy_member') || 'DineBuddy Member'}
                    </h1>

                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--profile-stack-gap)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {user.isOnline
                            ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> {t('status_online', 'Online')}</>
                            : t('active_member')}
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)' }}>
                                {publicInvitations.length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('invitations')}
                            </div>
                        </div>
                        <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--luxury-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <FaStar style={{ fontSize: '1rem' }} /> {user.reputation || 0}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('reputation_points')}
                            </div>
                        </div>
                        <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)' }}>
                                {joinedInvitations.length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('joined')}
                            </div>
                        </div>
                    </div>

                    {/* Action buttons: row 1 = follow + message, row 2 = report + mute + block */}
                    <div
                        className="user-profile-action-rows"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            maxWidth: '520px',
                            margin: '0 auto',
                            width: '100%'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                gap: '10px',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                alignItems: 'stretch'
                            }}
                        >
                            {userProfile?.role !== 'business' && canBeFollowed && (
                                <button
                                    onClick={() => {
                                        if (currentUser?.isGuest || !currentUser) {
                                            goToLogin();
                                            return;
                                        }
                                        toggleFollow(userId);
                                    }}
                                    className="btn"
                                    type="button"
                                    style={{
                                        flex: '1 1 140px',
                                        minHeight: '52px',
                                        background: isFollowing
                                            ? 'rgba(139, 92, 246, 0.15)'
                                            : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                        border: isFollowing ? '2px solid var(--primary)' : 'none',
                                        color: isFollowing ? 'var(--primary)' : 'white',
                                        fontSize: '0.95rem',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        transition: 'all 0.2s',
                                        padding: '0 14px',
                                        borderRadius: '14px'
                                    }}
                                >
                                    {isFollowing ? (
                                        <>
                                            <FaCheckCircle size={18} aria-hidden />
                                            <span>{t('following')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <FaUserFriends size={18} aria-hidden />
                                            <span>{t('follow')}</span>
                                        </>
                                    )}
                                </button>
                            )}
                            {userProfile?.role !== 'business' && !canBeFollowed && (
                                <div
                                    style={{
                                        flex: '1 1 140px',
                                        minHeight: '52px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        background: 'rgba(100,100,120,0.12)',
                                        border: '1px solid rgba(100,100,120,0.25)',
                                        borderRadius: '14px',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.88rem',
                                        fontWeight: '700',
                                        cursor: 'default',
                                        padding: '0 12px',
                                        textAlign: 'center'
                                    }}
                                >
                                    {t('following_disabled', '🔒 Following Disabled')}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    if (currentUser?.isGuest) {
                                        goToLogin();
                                        return;
                                    }
                                    navigate(`/chat/${userId}`);
                                }}
                                className="btn"
                                style={{
                                    flex: '1 1 140px',
                                    minHeight: '52px',
                                    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    padding: '0 14px',
                                    borderRadius: '14px'
                                }}
                            >
                                <FaComment size={18} aria-hidden />
                                <span>{t('message')}</span>
                            </button>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                alignItems: 'stretch'
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    if (currentUser?.isGuest) {
                                        goToLogin();
                                        return;
                                    }
                                    setIsReportModalOpen(true);
                                }}
                                className="btn"
                                style={{
                                    flex: '1 1 100px',
                                    minHeight: '48px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#EF4444',
                                    border: '1px solid rgba(239, 68, 68, 0.22)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontSize: '0.88rem',
                                    fontWeight: '700',
                                    padding: '10px 12px',
                                    borderRadius: '12px'
                                }}
                            >
                                <FaFlag size={16} aria-hidden />
                                <span>{t('profile_action_report', 'Report')}</span>
                            </button>

                            {myUid && !currentUser?.isGuest && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleToggleMute}
                                        disabled={socialBusy}
                                        className="btn"
                                        style={{
                                            flex: '1 1 100px',
                                            minHeight: '48px',
                                            background: iMutedThem ? 'rgba(139, 92, 246, 0.18)' : 'rgba(100, 116, 139, 0.1)',
                                            color: iMutedThem ? 'var(--primary)' : 'var(--text-muted)',
                                            border: `1px solid ${iMutedThem ? 'var(--primary)' : 'rgba(100, 116, 139, 0.28)'}`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            fontSize: '0.88rem',
                                            fontWeight: '700',
                                            padding: '10px 12px',
                                            borderRadius: '12px',
                                            opacity: socialBusy ? 0.6 : 1
                                        }}
                                    >
                                        <FaVolumeMute size={16} aria-hidden />
                                        <span>{iMutedThem ? t('unmute_user', 'Unmute') : t('mute_user', 'Mute')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleToggleBlock}
                                        disabled={socialBusy}
                                        className="btn"
                                        style={{
                                            flex: '1 1 100px',
                                            minHeight: '48px',
                                            background: iBlockedThem ? 'rgba(16, 185, 129, 0.1)' : 'rgba(185, 28, 28, 0.08)',
                                            color: iBlockedThem ? '#059669' : '#b91c1c',
                                            border: `1px solid ${iBlockedThem ? 'rgba(16, 185, 129, 0.35)' : 'rgba(185, 28, 28, 0.28)'}`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            fontSize: '0.88rem',
                                            fontWeight: '700',
                                            padding: '10px 12px',
                                            borderRadius: '12px',
                                            opacity: socialBusy ? 0.6 : 1
                                        }}
                                    >
                                        <FaBan size={16} aria-hidden />
                                        <span>{iBlockedThem ? t('unblock_user', 'Unblock') : t('block_user', 'Block')}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {stayOnProfileAfterBlock && iBlockedThem && (
                        <div
                            role="status"
                            style={{
                                marginTop: '14px',
                                maxWidth: '520px',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                padding: '12px 14px',
                                borderRadius: '14px',
                                fontSize: '0.85rem',
                                lineHeight: 1.45,
                                color: 'var(--text-muted)',
                                background: 'rgba(185, 28, 28, 0.07)',
                                border: '1px solid rgba(185, 28, 28, 0.2)',
                                textAlign: 'center'
                            }}
                        >
                            {t(
                                'block_grace_banner',
                                'This person is blocked. You can keep viewing this page; the simplified blocked view will show when you open their profile again.'
                            )}
                        </div>
                    )}
                </div>

                {isReportModalOpen && (
                    <NewReportModal
                        isOpen={isReportModalOpen}
                        onClose={() => setIsReportModalOpen(false)}
                        reportType="user"
                        targetId={user.id}
                        targetName={user.name}
                        onSubmit={submitReport}
                    />
                )}

                {/* User's Invitations — with section title */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📋 {t('invitation_history', 'Invitation History')}
                    </h3>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 'var(--profile-stack-gap)', overflowX: 'auto', scrollbarWidth: 'none' }}>
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
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({publicInvitations.length})</span>
                            </div>
                        </button>
                        {/* Private tab intentionally hidden from public profile view */}
                        <button
                            onClick={() => setActiveTab('joined')}
                            className={`profile-tab-btn ${activeTab === 'joined' ? 'active' : ''}`}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{t('stats_joined')}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({joinedInvitations.length})</span>
                            </div>
                        </button>
                    </div>

                    <div
                        className="user-profile-invitation-list-scroll"
                        role="region"
                        aria-label={t('invitation_history', 'Invitation History')}
                    >
                        {activeList.map(inv => (
                            <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                        ))}

                        {activeList.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                <p>{t('nothing_to_show')}</p>
                            </div>
                        )}
                    </div>
                    {activeList.length > INVITATION_HISTORY_SCROLL_HINT_THRESHOLD && (
                        <p
                            style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                textAlign: 'center',
                                marginTop: '10px',
                                marginBottom: 0,
                                opacity: 0.9
                            }}
                        >
                            {t('invitation_history_scroll_hint', 'Scroll to see more')}
                        </p>
                    )}
                </div>

                {/* Followers Section */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👥 {t('followers', 'Followers')}
                        </h3>
                    </div>

                    {networkLoading ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                            <div style={{ width: 28, height: 28, border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                        </div>
                    ) : networkUsers.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>
                            {t('no_network_yet', 'No connections yet')}
                        </p>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {networkUsers.slice(0, 5).map(netUser => (
                                    <div
                                        key={netUser.id}
                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 0' }}
                                        onClick={() => navigate(`/profile/${netUser.id}`)}
                                    >
                                        {/* Avatar with follow indicator */}
                                        <div
                                            style={{ position: 'relative', flexShrink: 0 }}
                                            onClick={(userProfile?.role !== 'business' && netUser.id !== (currentUser?.id || currentUser?.uid)) ? (e) => handleToggleFollow(netUser.id, e) : undefined}
                                        >
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden',
                                                border: `2px solid ${getGenderBorderColor(netUser)}`
                                            }}>
                                                <UserAvatar user={netUser} alt={netUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            {/* Follow badge — shows "+" when not followed, and not the current user */}
                                            {userProfile?.role !== 'business' && !netUser.isFollowedByMe && netUser.id !== (currentUser?.id || currentUser?.uid) && (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '-2px',
                                                    insetInlineEnd: '-2px',
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '50%',
                                                    background: 'var(--primary)',
                                                    border: '2px solid var(--bg-card)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '11px',
                                                    color: 'white',
                                                    fontWeight: '900',
                                                    lineHeight: 1
                                                }}>+</div>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {netUser.name}
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>


                            {networkUsers.length > 5 && (
                                <button
                                    onClick={() => navigate(`/followers/${userId}`)}
                                    style={{
                                        width: '100%',
                                        marginTop: '1rem',
                                        padding: '10px',
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        border: '1px solid var(--primary)',
                                        borderRadius: '12px',
                                        color: 'var(--primary)',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('view_all', 'View All')} ({networkUsers.length})
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
