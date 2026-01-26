import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { FaArrowRight, FaStar, FaUserFriends, FaCheckCircle } from 'react-icons/fa';

const UserProfile = () => {
    const { t, i18n } = useTranslation();
    const { userId } = useParams();
    const navigate = useNavigate();
    const { invitations, currentUser, toggleFollow } = useInvitations();

    // Find user from invitations (author data)
    const userInvitation = invitations.find(inv => inv.author?.id === userId);
    const user = userInvitation?.author;

    // If it's the current user, redirect to /profile
    if (userId === currentUser.id) {
        navigate('/profile');
        return null;
    }

    // If user not found
    if (!user) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem' }}>{i18n.language === 'ar' ? 'المستخدم غير موجود' : 'User not found'}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary">
                    {t('nav_home')}
                </button>
            </div>
        );
    }

    const isFollowing = currentUser.following?.includes(userId);
    const userPostedInvitations = invitations.filter(inv => inv.author?.id === userId);
    const userJoinedInvitations = invitations.filter(inv => inv.joined?.includes(userId));

    return (
        <div className="profile-page" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header with Back Button */}
            <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(25px)', padding: '0 1rem', marginBottom: '1rem' }}>
                <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800' }}>
                        {i18n.language === 'ar' ? 'الملف الشخصي' : 'Profile'}
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
                                position: 'relative'
                            }}
                        >
                            <img src={user.avatar} alt={user.name} className="host-avatar" />
                            <div className="host-status-online"></div>
                        </div>
                    </div>

                    <h1 style={{ fontSize: '2rem', fontWeight: '900', marginTop: '1rem', marginBottom: '0.5rem' }}>
                        {user.name}
                    </h1>

                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                        {i18n.language === 'ar' ? 'عضو نشط في DineBuddies' : 'Active DineBuddies member'}
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white' }}>
                                {userPostedInvitations.length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {i18n.language === 'ar' ? 'دعوات' : 'Invitations'}
                            </div>
                        </div>
                        <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--luxury-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <FaStar style={{ fontSize: '1rem' }} /> 450
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('reputation_points')}
                            </div>
                        </div>
                        <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white' }}>
                                {userJoinedInvitations.length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {i18n.language === 'ar' ? 'انضم' : 'Joined'}
                            </div>
                        </div>
                    </div>

                    {/* Follow Button */}
                    <button
                        onClick={() => toggleFollow(userId)}
                        className="btn btn-block"
                        style={{
                            height: '55px',
                            background: isFollowing
                                ? 'transparent'
                                : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                            border: isFollowing ? '2px solid var(--primary)' : 'none',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            maxWidth: '400px',
                            margin: '0 auto'
                        }}
                    >
                        {isFollowing ? (
                            <>
                                <FaCheckCircle />
                                <span>{i18n.language === 'ar' ? 'تتابع' : 'Following'}</span>
                            </>
                        ) : (
                            <>
                                <FaUserFriends />
                                <span>{i18n.language === 'ar' ? 'متابعة' : 'Follow'}</span>
                            </>
                        )}
                    </button>
                </div>

                {/* User's Invitations */}
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📋</span>
                        {i18n.language === 'ar' ? 'دعوات ' + user.name : user.name + "'s Invitations"}
                        <span style={{
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '900'
                        }}>
                            {userPostedInvitations.length}
                        </span>
                    </h3>

                    {userPostedInvitations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            <p>{i18n.language === 'ar' ? 'لم ينشر أي دعوات بعد' : 'No invitations posted yet'}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {userPostedInvitations.map(inv => (
                                <div
                                    key={inv.id}
                                    onClick={() => navigate(`/invitation/${inv.id}`)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '15px',
                                        padding: '12px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '15px',
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
                                        src={inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
                                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'; }}
                                        style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                                        alt={inv.title}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                                            {inv.title}
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span>{inv.location}</span>
                                            <span>•</span>
                                            <span>{inv.date ? inv.date.split('T')[0] : 'قريباً'}</span>
                                        </div>
                                    </div>
                                    <div style={{
                                        background: 'rgba(139, 92, 246, 0.2)',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: '800',
                                        color: 'var(--primary)',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {Math.max(0, inv.guestsNeeded - (inv.joined?.length || 0))} {i18n.language === 'ar' ? 'متبقي' : 'left'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
