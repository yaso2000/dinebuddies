import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import NewReportModal from '../components/NewReportModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowRight, FaStar, FaUserFriends, FaCheckCircle, FaFlag, FaComment, FaChevronRight } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';

const InvitationListItem = ({ inv, navigate, t }) => (
    <div
        onClick={() => navigate(inv.privacy === 'private' ? `/invitation/private/${inv.id}` : `/invitation/${inv.id}`)}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '15px',
            marginBottom: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'var(--bg-body)'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
            e.currentTarget.style.borderColor = 'var(--primary)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-body)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
    >
        <img
            src={inv.customImage || inv.restaurantImage || inv.videoThumbnail || inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'; }}
            style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
            alt={inv.title}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{inv.title}</h4>
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
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inv.date ? inv.date.split('T')[0] : t('soon')}</span>
        </div>
        <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
    </div>
);

const UserProfile = () => {
    const { t, i18n } = useTranslation();
    const { userId } = useParams();
    const navigate = useNavigate();
    const { invitations, currentUser, toggleFollow, submitReport } = useInvitations();
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('public');

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

    const isFollowing = currentUser?.following?.includes(userId);

    const publicInvitations = invitations.filter(inv =>
        inv.author?.id === userId &&
        inv.privacy !== 'private'
    );

    const privateInvitations = invitations.filter(inv =>
        inv.author?.id === userId &&
        inv.privacy === 'private' &&
        (inv.invitedFriends?.includes(currentUser?.id || currentUser?.uid))
    );

    const joinedInvitations = invitations.filter(inv =>
        inv.joined?.includes(userId) &&
        (inv.privacy !== 'private' || inv.invitedFriends?.includes(currentUser?.id || currentUser?.uid))
    );

    const getActiveList = () => {
        switch (activeTab) {
            case 'public': return publicInvitations;
            case 'private': return privateInvitations;
            case 'joined': return joinedInvitations;
            default: return [];
        }
    };

    const activeList = getActiveList();


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
                                border: `4px solid var(--primary)`,
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
                            <div className="host-status-online"></div>
                        </div>
                    </div>

                    <h1 style={{ fontSize: '2rem', fontWeight: '900', marginTop: '1rem', marginBottom: '0.5rem' }}>
                        {user.name || user.display_name || t('dinebuddy_member') || 'DineBuddy Member'}
                    </h1>

                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                        {t('active_member')}
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white' }}>
                                {publicInvitations.length + privateInvitations.length}
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
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white' }}>
                                {joinedInvitations.length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('joined')}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}>
                        <button
                            onClick={() => {
                                if (currentUser?.isGuest || !currentUser) {
                                    navigate('/login');
                                    return;
                                }
                                toggleFollow(userId);
                            }}
                            className="btn"
                            style={{
                                flex: 1,
                                height: '55px',
                                background: isFollowing
                                    ? 'rgba(139, 92, 246, 0.15)'
                                    : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                border: isFollowing ? '2px solid var(--primary)' : 'none',
                                color: isFollowing ? 'var(--primary)' : 'white',
                                fontSize: '1rem',
                                fontWeight: '900',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isFollowing ? (
                                <>
                                    <FaCheckCircle />
                                    <span>{t('following')}</span>
                                </>
                            ) : (
                                <>
                                    <FaUserFriends />
                                    <span>{t('follow')}</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (currentUser?.isGuest) {
                                    navigate('/login');
                                    return;
                                }
                                navigate(`/chat/${userId}`);
                            }}
                            className="btn"
                            style={{
                                flex: 1,
                                height: '55px',
                                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                                border: 'none',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '900',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            <FaComment />
                            <span>{t('message')}</span>
                        </button>

                        <button
                            onClick={() => {
                                if (currentUser?.isGuest) {
                                    navigate('/login');
                                    return;
                                }
                                setIsReportModalOpen(true);
                            }}
                            className="btn"
                            style={{
                                width: '55px',
                                height: '55px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                padding: 0
                            }}
                            title="Report User"
                        >
                            <FaFlag />
                        </button>
                    </div>
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

                {/* User's Invitations Restructured */}
                <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
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
                        <button
                            onClick={() => setActiveTab('private')}
                            className={`profile-tab-btn ${activeTab === 'private' ? 'active' : ''}`}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{t('stats_private')}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({privateInvitations.length})</span>
                            </div>
                        </button>
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

                    <div style={{ minHeight: '100px' }}>
                        {activeList.map(inv => (
                            <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                        ))}

                        {activeList.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                <p>{t('nothing_to_show')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
