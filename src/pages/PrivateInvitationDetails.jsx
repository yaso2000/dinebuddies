import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaComments, FaLock, FaTrash } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { getTemplateStyle } from '../utils/invitationTemplates';
import { getSafeAvatar } from '../utils/avatarUtils';
import PrivateInvitationInfoGrid from '../components/Invitation/PrivateInvitationInfoGrid';
import './PrivateInvitation.css';

import Lottie from 'lottie-react';
import { OCCASION_PRESETS } from '../utils/invitationTemplates';

const PrivateInvitationDetails = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { respondToPrivateInvitation, deleteInvitation } = useInvitations();

    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [invitedUsers, setInvitedUsers] = useState([]);
    const [isResponding, setIsResponding] = useState(false);
    const [animationData, setAnimationData] = useState(null);

    useEffect(() => {
        if (!id) return;

        const unsubscribe = onSnapshot(doc(db, 'invitations', id), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();

                // SECURITY CHECK: Only host or invited friends can see this
                const viewerId = currentUser?.uid || currentUser?.id;
                const authorId = data.authorId || data.author?.id;
                const isHost = viewerId === authorId;
                const isInvited = data.invitedFriends?.includes(viewerId);

                // For private invitations, we are VERY strict
                if (!isHost && !isInvited && viewerId !== 'guest') {
                    console.warn('🚫 Unauthorized access to private invitation');
                    navigate('/');
                    return;
                }

                setInvitation(data);

                // Fetch basic info for invited friends
                if (data.invitedFriends?.length > 0) {
                    const users = [];
                    for (const uid of data.invitedFriends) {
                        try {
                            const uSnap = await getDoc(doc(db, 'users', uid));
                            if (uSnap.exists()) {
                                users.push({
                                    id: uid,
                                    ...uSnap.data(),
                                    rsvpStatus: data.rsvps?.[uid] || 'pending'
                                });
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    setInvitedUsers(users);
                }
            } else {
                navigate('/');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, navigate, currentUser]);

    // Fetch Lottie data
    useEffect(() => {
        const lottieUrl = invitation ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.lottieUrl : null;
        if (lottieUrl) {
            fetch(lottieUrl)
                .then(res => res.json())
                .then(data => setAnimationData(data))
                .catch(err => console.error('Error loading Lottie animation in details:', err));
        }
    }, [invitation]);

    const handleRSVP = async (status) => {
        setIsResponding(true);
        try {
            await respondToPrivateInvitation(id, status);
        } finally {
            setIsResponding(false);
        }
    };

    if (loading) return <div className="loading-container">{t('loading')}</div>;
    if (!invitation) return null;

    const viewerId = currentUser?.uid || currentUser?.id;
    const isHost = viewerId === (invitation.authorId || invitation.author?.id);
    const myRSVP = invitation.rsvps?.[viewerId] || 'pending';
    const canChat = isHost || myRSVP === 'accepted';

    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    // Helpers for status badges
    const getStatusBadge = (status) => {
        switch (status) {
            case 'accepted':
                return { label: t('accepted'), color: '#10b981', icon: '✅' };
            case 'declined':
                return { label: t('declined'), color: '#ef4444', icon: '❌' };
            default:
                return { label: t('pending'), color: '#f59e0b', icon: '⏳' };
        }
    };

    return (
        <div className={`private-details-page page-container theme-${(invitation.occasionType || 'social').toLowerCase()}`} style={{ paddingBottom: '120px', position: 'relative' }}>
            {/* Lottie Background Animation */}
            {animationData && (
                <div className="lottie-bg-container" style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: -1,
                    opacity: 0.25,
                    pointerEvents: 'none'
                }}>
                    <Lottie
                        animationData={animationData}
                        loop={true}
                        autoPlay={true}
                        style={{ width: '100%', height: '100%' }}
                        rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
                    />
                </div>
            )}

            {/* Header / Nav */}
            <div className="private-details-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10, 10, 15, 0.4)', backdropFilter: 'blur(15px)' }}>
                <button onClick={() => navigate(-1)} className="back-circle-btn" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <FaArrowLeft />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(251, 191, 36, 0.1)', color: 'var(--luxury-gold)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                    <FaLock size={12} /> {t('private_invitation')}
                </div>
            </div>

            {/* Media Hero */}
            <div className="private-hero-section" style={{ position: 'relative', width: '100%', height: '280px', overflow: 'hidden', borderRadius: '0 0 40px 40px', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {(invitation.customImage || invitation.restaurantImage || invitation.image) ? (
                    <img src={invitation.customImage || invitation.restaurantImage || invitation.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #1e1b4b, #312e81)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaLock size={60} color="rgba(255,255,255,0.2)" />
                    </div>
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #0a0a0f 100%)' }} />
            </div>

            {/* Content Area */}
            <div className="private-details-content" style={{ padding: '0 15px' }}>
                <div className="reveal-text" style={{ transitionDelay: '0.2s' }}>
                    <h1 style={{
                        fontFamily: templateStyles?.layout?.fontFamily || 'inherit',
                        fontSize: '2.2rem',
                        fontWeight: '900',
                        textAlign: templateStyles?.layout?.textAlign || 'center',
                        color: 'white',
                        marginBottom: '10px',
                        lineHeight: '1.1',
                        textShadow: '0 4px 15px rgba(0,0,0,0.5)'
                    }}>
                        {invitation.title}
                    </h1>

                    {invitation.venueName && (
                        <div style={{
                            textAlign: templateStyles?.layout?.textAlign || 'center',
                            color: templateStyles?.layout?.accentColor || 'var(--luxury-gold)',
                            fontSize: '1.3rem',
                            fontWeight: '700',
                            marginBottom: '25px',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'inline-block',
                            padding: '5px 15px',
                            borderRadius: '12px',
                            width: 'auto',
                            margin: '0 auto 25px auto'
                        }}>
                            @ {invitation.venueName}
                        </div>
                    )}
                </div>

                {/* Description - Glassy card */}
                {invitation.description && (
                    <div className="reveal-text" style={{ transitionDelay: '0.4s', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                        <h3 style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>{t('message_to_friends', 'Message to Friends')}</h3>
                        <p style={{ color: 'rgba(255,255,255,0.95)', lineHeight: '1.6', fontSize: '1.1rem', fontWeight: '500' }}>{invitation.description}</p>
                    </div>
                )}

                {/* RSVP Actions for Invitees */}
                {!isHost && (
                    <div className="rsvp-card reveal-text" style={{
                        transitionDelay: '0.5s',
                        background: myRSVP === 'accepted' ? 'rgba(16, 185, 129, 0.1)' : myRSVP === 'declined' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${myRSVP === 'accepted' ? 'rgba(16, 185, 129, 0.3)' : myRSVP === 'declined' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        padding: '24px', borderRadius: '28px', marginBottom: '30px', textAlign: 'center', backdropFilter: 'blur(10px)'
                    }}>
                        {myRSVP === 'pending' ? (
                            <>
                                <h4 style={{ color: 'white', marginBottom: '15px', fontWeight: '800' }}>
                                    {t('will_you_attend?')}
                                </h4>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleRSVP('accepted')}
                                        disabled={isResponding}
                                        style={{
                                            flex: 1, height: '50px', borderRadius: '14px', border: 'none',
                                            background: '#10b981', color: 'white',
                                            fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                                        }}
                                    >
                                        {t('accept')}
                                    </button>
                                    <button
                                        onClick={() => handleRSVP('declined')}
                                        disabled={isResponding}
                                        style={{
                                            flex: 1, height: '50px', borderRadius: '14px', border: 'none',
                                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                            fontWeight: '800', cursor: 'pointer', border: '1px solid rgba(239, 68, 68, 0.2)'
                                        }}
                                    >
                                        {t('decline')}
                                    </button>
                                </div>
                            </>
                        ) : myRSVP === 'accepted' ? (
                            <>
                                <div style={{ color: '#10b981', fontSize: '2rem', marginBottom: '10px' }}>🎉</div>
                                <h4 style={{ color: 'white', marginBottom: '10px', fontWeight: '800' }}>{t('you_are_going!')}</h4>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '20px' }}>{t('invitation_accepted_hint')}</p>
                                <button
                                    onClick={() => navigate(`/invitation/${invitation.id}/chat`)}
                                    style={{
                                        width: '100%', height: '54px', borderRadius: '16px', border: 'none',
                                        background: 'var(--primary)', color: 'white',
                                        fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                        boxShadow: '0 10px 20px rgba(139, 92, 246, 0.3)', cursor: 'pointer'
                                    }}
                                >
                                    <FaComments /> {t('chat', 'Chat')}
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '10px' }}>👋</div>
                                <h4 style={{ color: 'white', marginBottom: '10px', fontWeight: '800' }}>{t('you_declined')}</h4>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '20px' }}>{t('hope_to_see_you_next_time')}</p>
                                <button
                                    onClick={() => navigate('/')}
                                    style={{
                                        width: '100%', height: '50px', borderRadius: '14px', border: '1px solid var(--border-color)',
                                        background: 'transparent', color: 'var(--text-muted)', fontWeight: '700', cursor: 'pointer'
                                    }}
                                >
                                    {t('back_home')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Coordination Grid */}
                <PrivateInvitationInfoGrid invitation={invitation} t={t} />

                {/* Invited Friends List */}
                <div className="invited-friends-section" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '15px', color: 'white' }}>{t('invited_friends')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {invitedUsers.length > 0 ? invitedUsers.map(user => {
                            const badge = getStatusBadge(user.rsvpStatus);
                            return (
                                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                                    <img src={getSafeAvatar(user)} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{user.display_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username || 'user'}</div>
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        fontWeight: '800',
                                        background: `${badge.color}15`,
                                        color: badge.color,
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        border: `1px solid ${badge.color}30`
                                    }}>
                                        {badge.icon} {badge.label}
                                    </div>
                                </div>
                            );
                        }) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('no_friends_invited')}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed Footer Actions - Only show chat if host OR accepted and outside of cards */}
            {isHost && (
                <div className="private-fixed-actions" style={{
                    position: 'fixed',
                    bottom: '90px',
                    left: '20px',
                    right: '20px',
                    display: 'flex',
                    gap: '12px',
                    zIndex: 1000
                }}>
                    <button
                        onClick={() => navigate(`/invitation/${invitation.id}/chat`)}
                        style={{
                            flex: 1, height: '54px', borderRadius: '18px', border: 'none',
                            background: 'var(--primary)', color: 'white',
                            fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            boxShadow: '0 10px 20px rgba(139, 92, 246, 0.3)',
                            cursor: 'pointer'
                        }}
                    >
                        <FaComments /> {t('chat', 'Chat')}
                    </button>
                    <button
                        style={{ width: '54px', height: '54px', borderRadius: '18px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        onClick={async () => {
                            if (window.confirm(t('confirm_delete_invitation', 'Are you sure you want to delete this invitation?'))) {
                                const success = await deleteInvitation(invitation.id);
                                if (success) {
                                    navigate('/');
                                }
                            }
                        }}
                    >
                        <FaTrash />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PrivateInvitationDetails;
