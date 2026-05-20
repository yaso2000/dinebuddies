import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaComments, FaLock, FaTrash } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { getTemplateStyle } from '../utils/invitationTemplates';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import PrivateInvitationInfoGrid from '../components/Invitation/PrivateInvitationInfoGrid';
import HostPrivateInvitationCardExport from '../components/Invitations/privateCard/HostPrivateInvitationCardExport';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import { DEFAULT_MOTION_ID } from '../components/Invitations/privateCard/privateCardMotions';
import {
    getDatingInvitationHeroCoverFromInvitation,
    getPrivateInvitationHeroCoverFromInvitation
} from '../components/Invitations/datingCard/datingCardBackgrounds';
import { getInvitationCardTextBackdropFromInvitation } from '../components/Invitations/privateCard/privateCardTextBackdrop';
import './PrivateInvitation.css';

import Lottie from 'lottie-react';
import { OCCASION_PRESETS } from '../utils/invitationTemplates';
import { asUidArray } from '../utils/userSocialLists';
import { goToLogin } from '../utils/goToLogin';
import { isPrivateInvitationDraft } from '../utils/privateInvitationDraft';

/** Stable string uid for Firestore comparisons (rules use request.auth.uid as string). */
function normUid(v) {
    if (v == null || v === '') return '';
    return typeof v === 'string' ? v : String(v);
}

/**
 * Classic private invites and DineBuddy dating invites both live in `private_invitations`
 * and use this route — same access rules for host + invitees.
 */
const PrivateInvitationDetails = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile, loading: authLoading } = useAuth();
    const { respondToPrivateInvitation, deleteInvitation } = useInvitations();

    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [invitedUsers, setInvitedUsers] = useState([]);
    const [isResponding, setIsResponding] = useState(false);
    const [animationData, setAnimationData] = useState(null);

    useEffect(() => {
        if (!id) return;

        // Wait for Firebase auth to settle — otherwise viewerId is undefined and we wrongly redirect.
        if (authLoading) {
            setLoading(true);
            return undefined;
        }

        // Use Firebase session uid only — NOT `isGuest` from context (that ORs userProfile?.isGuest
        // and can false-positive while the real account is signed in).
        const sessionUid = normUid(currentUser?.uid || currentUser?.id);
        if (!sessionUid || sessionUid === 'guest') {
            setLoading(false);
            goToLogin({ replace: true });
            return undefined;
        }

        let cancelled = false;
        let unsubscribe = () => {};

        auth.authStateReady().then(() => {
            if (cancelled) return;
            unsubscribe = onSnapshot(
                doc(db, 'private_invitations', id),
                async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();

                    // Access control is enforced by Firestore rules (host, invitee, or admin/staff).
                    // Do NOT duplicate "host || invitee" here — subtle mismatches (legacy fields, shapes)
                    // caused false redirects to home while reads were actually allowed.
                    const authorIdRaw = data.authorId ?? data.author?.id;
                    const isHost =
                        sessionUid === normUid(data.authorId) || sessionUid === normUid(data.author?.id);
                    const myBlocked = asUidArray(userProfile?.blockedUserIds);
                    const myMuted = asUidArray(userProfile?.mutedUserIds);
                    const authorBlockedKey = normUid(authorIdRaw);
                    if (
                        !isHost &&
                        authorBlockedKey &&
                        (myBlocked.includes(authorBlockedKey) || myMuted.includes(authorBlockedKey))
                    ) {
                        navigate('/', { replace: true });
                        return;
                    }

                    const hostCheck =
                        sessionUid === normUid(data.authorId) || sessionUid === normUid(data.author?.id);
                    if (!hostCheck && isPrivateInvitationDraft(data)) {
                        navigate('/', {
                            replace: true,
                            state: {
                                message: t('private_invitation_not_published', {
                                    defaultValue: 'This invitation has not been sent yet.'
                                })
                            }
                        });
                        return;
                    }

                    setInvitation(data);

                    // Fetch basic info for invited friends
                    if (!data.invitedFriends?.length) {
                        setInvitedUsers([]);
                    } else {
                        const users = [];
                        for (const fid of data.invitedFriends) {
                            const friendUid = normUid(typeof fid === 'string' ? fid : fid?.id);
                            if (!friendUid) continue;
                            try {
                                const uSnap = await getDoc(doc(db, 'users', friendUid));
                                if (uSnap.exists()) {
                                    users.push({
                                        id: friendUid,
                                        ...uSnap.data(),
                                        rsvpStatus: data.rsvps?.[friendUid] || 'pending'
                                    });
                                }
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        setInvitedUsers(users);
                    }
                } else {
                    navigate('/', { replace: true, state: { message: t('invitation_ended') } });
                }
                setLoading(false);
            },
            (err) => {
                console.error('private_invitations listener:', err);
                setLoading(false);
                if (err?.code === 'permission-denied') {
                    navigate('/', { replace: true, state: { message: t('invitation_ended') } });
                }
            }
            );
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [
        id,
        navigate,
        currentUser,
        authLoading,
        t,
        userProfile?.blockedUserIds,
        userProfile?.mutedUserIds
    ]);

    // Optional background animation (skip failed / blocked CDN responses)
    useEffect(() => {
        const lottieUrl = invitation ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.lottieUrl : null;
        if (!lottieUrl) return;
        let cancelled = false;
        fetch(lottieUrl, { mode: 'cors' })
            .then((res) => {
                if (!res.ok) return null;
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('json')) return null;
                return res.json();
            })
            .then((data) => {
                if (!cancelled && data) setAnimationData(data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [invitation]);

    const handleRSVP = async (status) => {
        setIsResponding(true);
        try {
            const ok = await respondToPrivateInvitation(id, status);
            if (!ok) return;
            if (status === 'accepted') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } finally {
            setIsResponding(false);
        }
    };

    if (loading) return <div className="loading-container">{t('loading')}</div>;
    if (!invitation) return null;

    const viewerId = normUid(currentUser?.uid || currentUser?.id);
    const isHost =
        viewerId === normUid(invitation.authorId) || viewerId === normUid(invitation.author?.id);
    const rsvpMap = invitation.rsvps || {};
    const myRSVP =
        rsvpMap[viewerId] ||
        rsvpMap[currentUser?.uid] ||
        rsvpMap[currentUser?.id] ||
        'pending';
    const canChat = isHost || myRSVP === 'accepted';

    // Edit is allowed only if NO ONE has accepted yet
    const hasAccepted = Object.values(invitation.rsvps || {}).some(s => s === 'accepted');
    const canEdit = isHost && !hasAccepted;
    const isDraft = isPrivateInvitationDraft(invitation);

    const cardHeroCover = !isDraft
        ? invitation.type === 'Dating'
            ? getDatingInvitationHeroCoverFromInvitation(invitation)
            : getPrivateInvitationHeroCoverFromInvitation(invitation)
        : null;
    const textBackdrop = getInvitationCardTextBackdropFromInvitation(invitation);

    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType,
        { cardFontFamily: invitation.cardFontFamily }
    );

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
            <div className="private-details-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-body)', backdropFilter: 'blur(15px)', borderBottom: '1px solid var(--border-color)' }}>
                <button onClick={() => navigate(-1)} className="back-circle-btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <FaArrowLeft />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(251, 191, 36, 0.1)', color: 'var(--luxury-gold)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                    <FaLock size={12} /> {t('private_invitation')}
                </div>
            </div>

                        {!isDraft && (
                <section className="private-details-card-hero reveal-text reveal-delay-1" aria-label={invitation.title}>
                    <div className="private-details-card-hero__glow" aria-hidden />
                    <div className="private-details-card-hero__card">
                        <PrivateInvitationCardPreview
                            className="private-invitation-card-preview--showcase private-invitation-card-preview--details-hero"
                            freezeMotion
                            cardTemplateSet={invitation.type === 'Dating' ? 'dating' : 'private'}
                            frameColorId={invitation.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                            cardThemeColor={
                                invitation.type === 'Private'
                                    ? invitation.privateCardThemeColor ?? null
                                    : invitation.datingCardThemeColor ?? invitation.datingCardTextColor ?? null
                            }
                            cardFontId={invitation.cardFontId ?? DEFAULT_FONT_ID}
                            cardMotionId={invitation.cardMotionId ?? DEFAULT_MOTION_ID}
                            occasionType={invitation.occasionType}
                            cardBackgroundId={invitation.cardBackgroundId || null}
                            heroCoverSrc={cardHeroCover?.src ?? null}
                            heroCoverMediaType={cardHeroCover?.mediaType ?? null}
                            heroCoverPoster={cardHeroCover?.poster ?? null}
                            title={invitation.title}
                            description={invitation.description}
                            date={invitation.date}
                            time={invitation.time}
                            location={invitation.location}
                            inviterName={invitation.author?.name || ''}
                            inviterAvatarUrl={getSafeAvatar(invitation.author || {})}
                            showHostAndMessage={
                                invitation.type === 'Dating'
                                    ? invitation.datingCardShowHostAndMessage !== false
                                    : invitation.type === 'Private'
                                      ? invitation.privateCardShowHostAndMessage !== false
                                      : true
                            }
                            textBackdropTone={
                                invitation.type === 'Private' || invitation.type === 'Dating'
                                    ? textBackdrop.tone
                                    : undefined
                            }
                        />
                    </div>
                </section>
            )}

            {/* Content Area */}
            <div className="private-details-content" style={{ padding: '0 15px' }}>
                {isHost && isDraft && (
                    <div
                        className="private-draft-host-banner"
                        style={{
                            marginBottom: 20,
                            padding: '14px 16px',
                            borderRadius: 16,
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.35)'
                        }}
                    >
                        <p style={{ margin: '0 0 10px', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.92rem' }}>
                            {t('private_invitation_draft_banner', {
                                defaultValue:
                                    'This invitation is still a draft — guests have not been notified yet. Open preview to review and send.'
                            })}
                        </p>
                        <button
                            type="button"
                            className="vip-btn vip-btn-primary"
                            onClick={() => navigate(`/invitation/private/preview/${invitation.id}`)}
                            style={{ width: '100%', minHeight: 46, borderRadius: 12, border: 'none', fontWeight: 800 }}
                        >
                            {t('continue_to_preview', { defaultValue: 'Continue to preview & send' })}
                        </button>
                    </div>
                )}
                {(invitation.venueName || invitation.restaurantName) && !isDraft && (
                    <p className="private-details-venue-chip reveal-text reveal-delay-2">
                        @ {invitation.venueName || invitation.restaurantName}
                    </p>
                )}

                {isHost && !isDraft && <HostPrivateInvitationCardExport invitation={invitation} />}

                {/* Description - Glassy card (dating: hidden when host chose title-only card) */}
                {invitation.description &&
                    (invitation.type !== 'Dating' || invitation.datingCardShowHostAndMessage !== false) &&
                    (invitation.type !== 'Private' || invitation.privateCardShowHostAndMessage !== false) && (
                        <div className="reveal-text premium-glass-card reveal-delay-2" style={{ marginBottom: '2rem', padding: '1.2rem', borderRadius: '24px' }}>
                            <h3 style={{ fontSize: '0.75rem', color: 'var(--luxury-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>{t('message_to_friends', 'Message to Friends')}</h3>
                            <p style={{ color: 'var(--text-main)', lineHeight: '1.6', fontSize: '1.1rem', fontWeight: '500' }}>{invitation.description}</p>
                        </div>
                    )}

                {/* RSVP Actions for Invitees */}
                {!isHost && (
                    <div className="rsvp-card reveal-text reveal-delay-3" style={{
                        background: myRSVP === 'accepted' ? 'rgba(16, 185, 129, 0.1)' : myRSVP === 'declined' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${myRSVP === 'accepted' ? 'rgba(16, 185, 129, 0.3)' : myRSVP === 'declined' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        padding: '24px', borderRadius: '28px', marginBottom: '30px', textAlign: 'center', backdropFilter: 'blur(10px)'
                    }}>
                        {myRSVP === 'pending' ? (
                            <>
                                <h4 style={{ color: 'var(--text-main)', marginBottom: '15px', fontWeight: '800' }}>
                                    {t('will_you_attend?')}
                                </h4>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleRSVP('accepted')}
                                        disabled={isResponding}
                                        className="vip-btn"
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
                                            flex: 1, height: '50px', borderRadius: '14px',
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
                                <h4 style={{ color: 'var(--text-main)', marginBottom: '10px', fontWeight: '800' }}>{t('you_are_going!')}</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>{t('invitation_accepted_hint')}</p>
                                    <button
                                        onClick={() => navigate(`/invitation/private/${invitation.id}/chat`)}
                                        className="vip-btn vip-btn-primary"
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
                                <h4 style={{ color: 'var(--text-main)', marginBottom: '10px', fontWeight: '800' }}>{t('you_declined')}</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>{t('hope_to_see_you_next_time')}</p>
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
                <div className="invited-friends-section premium-glass-card reveal-text reveal-delay-4" style={{ marginBottom: '2rem', padding: '20px', borderRadius: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '15px', color: 'var(--text-main)' }}>{t('invited_friends')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {invitedUsers.length > 0 ? invitedUsers.map(user => {
                            const badge = getStatusBadge(user.rsvpStatus);
                            return (
                                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                                    <img src={getSafeAvatar(user)} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{user.display_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username || t('username_fallback', 'user')}</div>
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
                {/* Host Actions - inline, below the guest list */}
                {isHost && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', marginBottom: '2rem' }}>
                        <button
                            onClick={() => navigate(`/invitation/private/${invitation.id}/chat`)}
                            className="vip-btn vip-btn-primary"
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

                        {canEdit && (
                            <button
                                onClick={() =>
                                    navigate(
                                        invitation.type === 'Dating'
                                            ? '/create-dating'
                                            : '/create-private',
                                        { state: { editInvitation: invitation } }
                                    )
                                }
                                style={{
                                    width: '54px', height: '54px', borderRadius: '18px',
                                    border: '1px solid rgba(139, 92, 246, 0.4)',
                                    background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', fontSize: '1.1rem'
                                }}
                                title={t('edit_invitation', 'Edit invitation')}
                            >
                                ✏️
                            </button>
                        )}

                        <button
                            style={{ width: '54px', height: '54px', borderRadius: '18px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            onClick={async () => {
                                if (window.confirm(t('confirm_delete_invitation', 'Are you sure you want to delete this invitation?'))) {
                                    const success = await deleteInvitation(invitation.id, true);
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
        </div>
    );
};

export default PrivateInvitationDetails;

