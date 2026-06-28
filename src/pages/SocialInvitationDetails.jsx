import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaComments, FaLock, FaTrash } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { getTemplateStyle } from '../utils/invitationTemplates';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import SocialInvitationInfoGrid from '../components/Invitation/SocialInvitationInfoGrid';
import PrivateInvitationPairShowcase from '../components/Invitations/privateCard/PrivateInvitationPairShowcase';
import SocialInvitationExternalShare from '../components/Invitations/socialCard/SocialInvitationExternalShare';
import SocialInvitationShareCapture from '../components/Invitations/socialCard/SocialInvitationShareCapture';
import { buildSocialInvitationCardPreviewProps } from '../components/Invitations/socialCard/buildSocialInvitationCardPreviewProps';
import '../components/Invitations/socialCard/SocialInvitationExternalShare.css';
import SocialInvitationCardPreview from '../components/Invitations/socialCard/SocialInvitationCardPreview';
import { getPrivateInvitationHeroCoverFromInvitation } from '../components/Invitations/privateCard/privateCardBackgrounds';
import { getSocialInvitationHeroCoverFromInvitation } from '../components/Invitations/socialCard/socialCardBackgrounds';
import { isPrivateHostedInvitation } from '../utils/inviteCategory';
import {
  getHostedInvitationChatPath,
  getHostedInvitationDetailsPath,
  getHostedInvitationPreviewPath } from
'../utils/hostedInvitationRoutes';
import { getInvitationCardTextBackdropFromInvitation } from '../components/Invitations/socialCard/socialCardTextBackdrop';
import './SocialInvitation.css';

import Lottie from 'lottie-react';
import { OCCASION_PRESETS } from '../utils/invitationTemplates';
import { asUidArray } from '../utils/userSocialLists';
import { goToLogin, getCurrentReturnPath } from '../utils/goToLogin';
import { isPrivateInvitationDraft } from '../utils/socialInvitationDraft';
import { normalizePersonalInviteCategory } from '../constants/personalInviteCategories';

/** Stable string uid for Firestore comparisons (rules use request.auth.uid as string). */import { AppText } from "../components/base";
function normUid(v) {
  if (v == null || v === '') return '';
  return typeof v === 'string' ? v : String(v);
}

/**
 * Classic private invites and DineBuddy dating invites both live in `private_invitations`
 * and use this route — same access rules for host + invitees.
 */
const SocialInvitationDetails = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const { respondToPrivateInvitation, deleteInvitation } = useInvitations();

  const cardCaptureRef = useRef(null);
  const listenerKeyRef = useRef('');

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [isResponding, setIsResponding] = useState(false);
  const [animationData, setAnimationData] = useState(null);

  const viewerUid = normUid(currentUser?.uid || currentUser?.id);
  const blockedAuthorKey = useMemo(
    () => JSON.stringify(asUidArray(userProfile?.blockedUserIds)),
    [userProfile?.blockedUserIds]
  );
  const mutedAuthorKey = useMemo(
    () => JSON.stringify(asUidArray(userProfile?.mutedUserIds)),
    [userProfile?.mutedUserIds]
  );

  const cardHeroCover = useMemo(() => {
    if (!invitation || isPrivateInvitationDraft(invitation)) return null;
    return isPrivateHostedInvitation(invitation) ?
    getPrivateInvitationHeroCoverFromInvitation(invitation) :
    getSocialInvitationHeroCoverFromInvitation(invitation);
  }, [invitation]);

  const textBackdrop = useMemo(
    () => invitation ? getInvitationCardTextBackdropFromInvitation(invitation) : null,
    [invitation]
  );

  const cardPreviewProps = useMemo(() => {
    if (!invitation || isPrivateInvitationDraft(invitation)) return null;
    return buildSocialInvitationCardPreviewProps(invitation, {
      heroCover: cardHeroCover,
      inviterName:
      userProfile?.display_name ||
      userProfile?.displayName ||
      invitation.author?.displayName ||
      invitation.author?.name ||
      '',
      inviterAvatarUrl: getSafeAvatar(invitation.author || userProfile || {}),
      textBackdrop,
      className: 'social-invitation-card-preview--showcase social-invitation-card-preview--details-hero'
    });
  }, [invitation, cardHeroCover, textBackdrop, userProfile]);

  useEffect(() => {
    if (!id) return;

    if (authLoading) {
      setLoading(true);
      return undefined;
    }

    const listenerKey = `${id}:${viewerUid}:${blockedAuthorKey}:${mutedAuthorKey}`;
    const isNewListener = listenerKeyRef.current !== listenerKey;
    if (isNewListener) {
      listenerKeyRef.current = listenerKey;
      setAccessError(null);
      setLoading(true);
    }

    let cancelled = false;
    let unsubscribe = () => {};

    auth.authStateReady().then(() => {
      if (cancelled) return;

      // Prefer Firebase session uid — AuthContext can lag on mobile cold start.
      const sessionUid = normUid(auth.currentUser?.uid || viewerUid);
      if (!sessionUid || sessionUid === 'guest') {
        setLoading(false);
        goToLogin({ replace: true, returnPath: getCurrentReturnPath() });
        return;
      }

      unsubscribe = onSnapshot(
        doc(db, 'social_invitations', id),
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();

            const authorIdRaw = data.authorId ?? data.author?.id;
            const isHost =
            sessionUid === normUid(data.authorId) || sessionUid === normUid(data.author?.id);
            const myBlocked = asUidArray(userProfile?.blockedUserIds);
            const myMuted = asUidArray(userProfile?.mutedUserIds);
            const authorBlockedKey = normUid(authorIdRaw);
            if (
            !isHost &&
            authorBlockedKey && (
            myBlocked.includes(authorBlockedKey) || myMuted.includes(authorBlockedKey)))
            {
              setInvitation(null);
              setAccessError('blocked');
              setLoading(false);
              return;
            }

            const hostCheck =
            sessionUid === normUid(data.authorId) || sessionUid === normUid(data.author?.id);
            if (!hostCheck && isPrivateInvitationDraft(data)) {
              setInvitation(null);
              setAccessError('draft');
              setLoading(false);
              return;
            }

            setAccessError(null);
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
            setInvitation(null);
            setAccessError('not_found');
          }
          setLoading(false);
        },
        (err) => {
          console.error('social_invitations listener:', err);
          setInvitation(null);
          setLoading(false);
          if (err?.code === 'permission-denied') {
            setAccessError('permission');
          } else {
            setAccessError('unknown');
          }
        }
      );
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id, authLoading, viewerUid, blockedAuthorKey, mutedAuthorKey]);

  // Optional background animation (skip failed / blocked CDN responses)
  useEffect(() => {
    const lottieUrl = invitation ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.lottieUrl : null;
    if (!lottieUrl) return;
    let cancelled = false;
    fetch(lottieUrl, { mode: 'cors' }).
    then((res) => {
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) return null;
      return res.json();
    }).
    then((data) => {
      if (!cancelled && data) setAnimationData(data);
    }).
    catch(() => {});
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

  const isHost = useMemo(() => {
    if (!invitation) return false;
    return (
      viewerUid === normUid(invitation.authorId) ||
      viewerUid === normUid(invitation.author?.id));

  }, [invitation, viewerUid]);

  const myRSVP = useMemo(() => {
    if (!invitation) return 'pending';
    const rsvpMap = invitation.rsvps || {};
    return (
      rsvpMap[viewerUid] ||
      rsvpMap[currentUser?.uid] ||
      rsvpMap[currentUser?.id] ||
      'pending');

  }, [invitation, viewerUid, currentUser?.uid, currentUser?.id]);

  const isPrivateInvitation = invitation?.type === 'Private';

  const personalInviteCategory = useMemo(
    () => normalizePersonalInviteCategory(invitation?.personalInviteCategory),
    [invitation?.personalInviteCategory]
  );

  const detailsThemeClass = isPrivateInvitation
    ? `theme-personal-${personalInviteCategory}`
    : `theme-${(invitation?.occasionType || 'social').toLowerCase()}`;

  const datingHostProfile = useMemo(() => {
    if (!invitation) return null;
    const hostId = normUid(invitation.authorId || invitation.author?.id);
    return {
      id: hostId,
      display_name:
      invitation.author?.name ||
      invitation.author?.displayName ||
      invitation.authorName ||
      '',
      photoURL:
      invitation.author?.photo ||
      invitation.author?.photoURL ||
      invitation.authorAvatarUrl,
      gender: invitation.author?.gender,
      role: invitation.author?.role
    };
  }, [invitation]);

  const datingGuestProfile = useMemo(() => {
    if (!invitation) return null;
    if (isHost) {
      return invitedUsers[0] || null;
    }
    const selfFromList = invitedUsers.find((u) => normUid(u.id) === viewerUid);
    if (selfFromList) return selfFromList;
    if (userProfile) {
      return {
        id: viewerUid,
        ...userProfile,
        rsvpStatus: myRSVP
      };
    }
    return null;
  }, [invitation, isHost, invitedUsers, viewerUid, userProfile, myRSVP]);

  const datingGuestRsvp = useMemo(() => {
    if (isHost) {
      return invitedUsers[0]?.rsvpStatus || 'pending';
    }
    return myRSVP;
  }, [isHost, invitedUsers, myRSVP]);

  if (loading) return <div className="loading-container">{t('loading')}</div>;

  if (accessError && !invitation) {
    const message =
    accessError === 'permission' ?
    t('social_invitation_access_denied', {
      defaultValue: 'You do not have access to this invitation.'
    }) :
    accessError === 'draft' ?
    t('social_invitation_not_published', {
      defaultValue: 'This invitation has not been sent yet.'
    }) :
    accessError === 'blocked' ?
    t('social_invitation_blocked_host', {
      defaultValue: 'You cannot view invitations from this person.'
    }) :
    t('invitation_ended');
    return (
      <div className="page-container" style={{ padding: '2rem 1rem', maxWidth: 480, margin: '0 auto' }}>
                <AppText as="p" style={{ color: 'var(--text-main)', fontWeight: 700, marginBottom: 16 }}>{message}</AppText>
                <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={() => navigate('/profile', { replace: true })}>
          
                    {t('back_to_profile', { defaultValue: 'Back to profile' })}
                </button>
            </div>);

  }

  if (!invitation) {
    return (
      <div className="loading-container">{t('loading')}</div>);

  }

  const canChat = isHost || myRSVP === 'accepted';

  // Edit is allowed only if NO ONE has accepted yet
  const hasAccepted = Object.values(invitation.rsvps || {}).some((s) => s === 'accepted');
  const canEdit = isHost && !hasAccepted;
  const isDraft = isPrivateInvitationDraft(invitation);

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
    <div className={`private-details-page page-container ${detailsThemeClass}`} style={{ paddingBottom: '120px', position: 'relative' }}>
            {/* Lottie Background Animation */}
            {animationData &&
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
          rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }} />
        
                </div>
      }

            {/* Header / Nav */}
            <div className="private-details-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-body)', backdropFilter: 'blur(15px)', borderBottom: '1px solid var(--border-color)' }}>
                <button onClick={() => navigate(-1)} className="back-circle-btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <FaArrowLeft />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(251, 191, 36, 0.1)', color: 'var(--luxury-gold)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                    <FaLock size={12} /> {t('social_invitation')}
                </div>
            </div>

                        {!isDraft &&
      <section className="private-details-card-hero reveal-text reveal-delay-1" aria-label={invitation.title}>
                    <div className="private-details-card-hero__glow" aria-hidden />
                    <div className="private-details-card-hero__card">
                        {cardPreviewProps ?
          <SocialInvitationCardPreview {...cardPreviewProps} /> :
          null}
                    </div>
                </section>
      }

            {isHost && !isDraft && cardPreviewProps ?
      <SocialInvitationShareCapture ref={cardCaptureRef} cardPreviewProps={cardPreviewProps} /> :
      null}

            {/* Content Area */}
            <div className="private-details-content" style={{ padding: '0 15px' }}>
                {isHost && isDraft &&
        <div
          className="private-draft-host-banner"
          style={{
            marginBottom: 20,
            padding: '14px 16px',
            borderRadius: 16,
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)'
          }}>
          
                        <AppText as="p" style={{ margin: '0 0 10px', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.92rem' }}>
                            {t('social_invitation_draft_banner', {
              defaultValue:
              'This invitation is still a draft — guests have not been notified yet. Open preview to review and send.'
            })}
                        </AppText>
                        <button
            type="button"
            className="vip-btn vip-btn-primary"
            onClick={() => navigate(getHostedInvitationPreviewPath(invitation))}
            style={{ width: '100%', minHeight: 46, borderRadius: 12, border: 'none', fontWeight: 800 }}>
            
                            {t('continue_to_preview', { defaultValue: 'Continue to preview & send' })}
                        </button>
                    </div>
        }
                {(invitation.venueName || invitation.restaurantName) && !isDraft &&
        <AppText as="p" className="private-details-venue-chip reveal-text reveal-delay-2">
                        @ {invitation.venueName || invitation.restaurantName}
                    </AppText>
        }

                {isHost && !isDraft &&
        <SocialInvitationExternalShare
          invitation={{
            ...invitation,
            inviterName:
            userProfile?.display_name ||
            userProfile?.displayName ||
            invitation.author?.displayName ||
            ''
          }}
          cardCaptureRef={cardCaptureRef}
          className="private-external-share--details" />

        }

                {/* Description - Glassy card (dating: hidden when host chose title-only card) */}
                {invitation.description && (
        invitation.type !== 'Dating' || invitation.privateCardShowHostAndMessage !== false) && (
        invitation.type !== 'Private' || invitation.socialCardShowHostAndMessage !== false) &&
        <div className="reveal-text premium-glass-card reveal-delay-2" style={{ marginBottom: '2rem', padding: '1.2rem', borderRadius: '24px' }}>
                            <AppText as="h3" style={{ fontSize: '0.75rem', color: 'var(--luxury-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>{t('message_to_friends', 'Message to Friends')}</AppText>
                            <AppText as="p" style={{ color: 'var(--text-main)', lineHeight: '1.6', fontSize: '1.1rem', fontWeight: '500' }}>{invitation.description}</AppText>
                        </div>
        }

                {/* RSVP Actions for Invitees */}
                {!isHost &&
        <div className="rsvp-card reveal-text reveal-delay-3" style={{
          background: myRSVP === 'accepted' ? 'rgba(16, 185, 129, 0.1)' : myRSVP === 'declined' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${myRSVP === 'accepted' ? 'rgba(16, 185, 129, 0.3)' : myRSVP === 'declined' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          padding: '24px', borderRadius: '28px', marginBottom: '30px', textAlign: 'center', backdropFilter: 'blur(10px)'
        }}>
                        {myRSVP === 'pending' ?
          <>
                                <AppText as="h4" style={{ color: 'var(--text-main)', marginBottom: '15px', fontWeight: '800' }}>
                                    {t('will_you_attend?')}
                                </AppText>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                onClick={() => handleRSVP('accepted')}
                disabled={isResponding}
                className="vip-btn"
                style={{
                  flex: 1, height: '50px', borderRadius: '14px', border: 'none',
                  background: '#10b981', color: 'white',
                  fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}>
                
                                        {t('accept')}
                                    </button>
                                    <button
                onClick={() => handleRSVP('declined')}
                disabled={isResponding}
                style={{
                  flex: 1, height: '50px', borderRadius: '14px',
                  background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                  fontWeight: '800', cursor: 'pointer', border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                
                                        {t('decline')}
                                    </button>
                                </div>
                            </> :
          myRSVP === 'accepted' ?
          <>
                                <div style={{ color: '#10b981', fontSize: '2rem', marginBottom: '10px' }}>🎉</div>
                                <AppText as="h4" style={{ color: 'var(--text-main)', marginBottom: '10px', fontWeight: '800' }}>{t('you_are_going!')}</AppText>
                                <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>{t('invitation_accepted_hint')}</AppText>
                                    <button
              onClick={() => navigate(getHostedInvitationChatPath(invitation))}
              className="vip-btn vip-btn-primary"
              style={{
                width: '100%', height: '54px', borderRadius: '16px', border: 'none',
                background: 'var(--primary)', color: 'white',
                fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: '0 10px 20px rgba(139, 92, 246, 0.3)', cursor: 'pointer'
              }}>
              
                                    <FaComments /> {t('chat', 'Chat')}
                                </button>
                            </> :

          <>
                                <div style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '10px' }}>👋</div>
                                <AppText as="h4" style={{ color: 'var(--text-main)', marginBottom: '10px', fontWeight: '800' }}>{t('you_declined')}</AppText>
                                <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>{t('hope_to_see_you_next_time')}</AppText>
                                <button
              onClick={() => navigate('/')}
              style={{
                width: '100%', height: '50px', borderRadius: '14px', border: '1px solid var(--border-color)',
                background: 'transparent', color: 'var(--text-muted)', fontWeight: '700', cursor: 'pointer'
              }}>
              
                                    {t('back_home')}
                                </button>
                            </>
          }
                    </div>
        }

                {/* Coordination Grid */}
                <SocialInvitationInfoGrid invitation={invitation} t={t} />

                {/* Dating: intimate host + guest pairing | Private: guest list */}
                {isPrivateInvitation ?
        <PrivateInvitationPairShowcase
          host={datingHostProfile}
          guest={datingGuestProfile}
          guestRsvpStatus={datingGuestRsvp}
          personalInviteCategory={personalInviteCategory}
          t={t} /> :


        <div className="invited-friends-section premium-glass-card reveal-text reveal-delay-4" style={{ marginBottom: '2rem', padding: '20px', borderRadius: '24px' }}>
                    <AppText as="h3" style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '15px', color: 'var(--text-main)' }}>{t('invited_friends')}</AppText>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {invitedUsers.length > 0 ? invitedUsers.map((user) => {
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
                                </div>);

            }) :
            <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('no_friends_invited')}</AppText>
            }
                    </div>
                </div>
        }
                {/* Host Actions - inline, below the guest list */}
                {isHost &&
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', marginBottom: '2rem' }}>
                        <button
            onClick={() => navigate(getHostedInvitationChatPath(invitation))}
            className="vip-btn vip-btn-primary"
            style={{
              flex: 1, height: '54px', borderRadius: '18px', border: 'none',
              background: 'var(--primary)', color: 'white',
              fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              boxShadow: '0 10px 20px rgba(139, 92, 246, 0.3)',
              cursor: 'pointer'
            }}>
            
                            <FaComments /> {t('chat', 'Chat')}
                        </button>

                        {canEdit &&
          <button
            onClick={() =>
            navigate(
              invitation.type === 'Private' ?
              '/create-private' :
              '/create-social',
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
            title={t('edit_invitation', 'Edit invitation')}>
            
                                ✏️
                            </button>
          }

                        <button
            style={{ width: '54px', height: '54px', borderRadius: '18px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onClick={async () => {
              if (window.confirm(t('confirm_delete_invitation', 'Are you sure you want to delete this invitation?'))) {
                const success = await deleteInvitation(invitation.id, true);
                if (success) {
                  navigate('/');
                }
              }
            }}>
            
                            <FaTrash />
                        </button>
                    </div>
        }
            </div>
        </div>);

};

export default SocialInvitationDetails;