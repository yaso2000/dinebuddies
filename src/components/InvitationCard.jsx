import React, { useState, useRef } from 'react';
import { FaMapMarkerAlt, FaClock, FaCalendarAlt, FaChevronRight, FaPaperPlane, FaPlus, FaCheck, FaFlag, FaMars, FaVenus, FaVenusMars, FaGenderless, FaMoneyBillWave, FaUserFriends, FaShareAlt, FaVideo, FaVolumeUp, FaVolumeMute, FaBullhorn, FaHeart, FaUsers, FaBriefcase, FaSmile, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import NewReportModal from './NewReportModal';
import { getTemplateStyle, normalizePublicCardTemplateKey } from '../utils/invitationTemplates';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';
const INVITATION_CARD_IMAGE_FALLBACK =
'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import { shareNativeOrFallback } from '../utils/shareNativeOrFallback';
import { buildInvitationFeedAttachment } from '../utils/invitationFeedAttachment';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from "./base";

const InvitationCard = ({ invitation }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, toggleFollow, submitReport, deleteInvitation } = useInvitations();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [showReportModal, setShowReportModal] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [cardPreviewUrl, setCardPreviewUrl] = useState(null); // desktop fallback
  const shareCardFileRef = useRef(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const [videoDurationLabel, setVideoDurationLabel] = useState('');

  const isRTL = i18n.language === 'ar' || i18n.language?.startsWith('ar');

  const {
    id, author, title, type, location, paymentType,
    guestsNeeded, joined = [], requests = [], date,
    image, time, description, genderPreference, ageRange,
    // NEW: Video fields
    mediaSource, mediaType, customVideo, videoThumbnail,
    customImage, restaurantImage, occasionType, inviteMood
  } = invitation;

  const templateKey = normalizePublicCardTemplateKey(invitation.templateType || 'classic');

  // Get template styles (canonical layout key)
  const templateStyles = getTemplateStyle(
    templateKey,
    invitation.colorScheme || 'oceanBlue',
    inviteMood || occasionType,
    { cardFontFamily: invitation.cardFontFamily }
  );

  const isHost = author?.id === currentUser?.id;
  const isPending = (requests || []).includes(currentUser?.id);
  const isAccepted = (joined || []).includes(currentUser?.id);
  const spotsLeft = Math.max(0, guestsNeeded - (joined || []).length);
  const isFollowing = userProfile?.following?.includes(author?.id);

  // Business accounts cannot interact with invitations

  // Unified button style for header actions
  const actionBtnStyle = {
    width: '34px',
    height: '34px',
    minWidth: '34px', // Prevent shrinking
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    padding: 0,
    margin: 0, // Remove default browser margins
    flexShrink: 0
  };

  const handleAction = (e) => {
    e.stopPropagation();
    if (isHost || isAccepted || isPending || spotsLeft > 0) {
      navigate(`/invitation/${id}`);
    }
  };

  const handleFollowClick = (e) => {
    e.stopPropagation();
    toggleFollow(author?.id);
  };

  const handleAvatarClick = (e) => {
    e.stopPropagation();
    navigate(author?.id === currentUser?.id ? '/profile' : `/profile/${author?.id}`);
  };

  const checkEligibility = () => {
    // Business accounts cannot join invitations
    if (userProfile?.role === 'business') {
      return { eligible: false, reason: t('business_cannot_join', { defaultValue: 'Business accounts cannot join invitations' }) };
    }

    // Check gender preference
    // Check gender preference (Unified)
    if (invitation.genderGroups && invitation.genderGroups.length > 0 && !invitation.genderGroups.includes('any')) {
      if (currentUser?.gender && !invitation.genderGroups.includes(currentUser.gender)) {
        return { eligible: false, reason: t('gender_mismatch') };
      }
    } else if (genderPreference && genderPreference !== 'any' && genderPreference !== 'custom' && currentUser?.gender !== genderPreference) {
      return { eligible: false, reason: t('gender_mismatch') };
    }

    // Check age range preference
    if (ageRange && currentUser?.age) {
      const [minAge, maxAge] = ageRange.split('-').map(Number);
      const userAge = currentUser.age;
      if (userAge < minAge || userAge > maxAge) {
        return { eligible: false, reason: `${t('age_range_preference')}: ${ageRange}` };
      }
    }

    return { eligible: true };
  };
  const eligibility = checkEligibility();

  const formatInviteDate = () => {
    if (!date) return t('tbd', { defaultValue: 'TBD' });
    const d = new Date(date);
    return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const formatInviteTime = () => {
    if (!time) return '';
    return time.includes('T') ? time.split('T')[1].substring(0, 5) : time;
  };
  const paymentLabel = paymentType ?
  t(`payment_type_${String(paymentType).toLowerCase().replace(/ /g, '_')}`, { defaultValue: paymentType }) :
  t('payment_split');
  const guestsMeta = `${guestsNeeded} ${t('guests', { defaultValue: 'Guests' })}`;
  const distanceMeta = invitation.distance != null && invitation.distance !== undefined ?
  `${invitation.distance.toFixed(1)} ${t('km_away', { defaultValue: 'km away' })}` :
  null;

  const shareUrl = `${window.location.origin}/invitation/${id}`;
  const cardVariant = templateStyles.layout?.cardVariant ?? 'photoBottom';
  const shareMeta = {
    dateLine: formatInviteDate(),
    timeLine: formatInviteTime() || '—',
    guestsLine: guestsMeta,
    paymentLine: paymentLabel,
    distanceLine: distanceMeta || ''
  };

  const isVideo = mediaType === 'video' && customVideo;

  const storyData = {
    title,
    image:
    pickSafeDisplayImageUrl(videoThumbnail, customImage, restaurantImage, image) || (
    !isVideo ? INVITATION_CARD_IMAGE_FALLBACK : undefined),
    description,
    date,
    time,
    location,
    maxGuests: guestsNeeded,
    hostName: author?.name,
    hostImage: getSafeAvatar(author),
    shareUrl,
    shareLayout: cardVariant,
    shareMeta,
    videoDurationLabel: isVideo ? videoDurationLabel : ''
  };

  // Direct image share — generates card and opens native share sheet (Windows/Mobile)
  const handleShare = async (e) => {
    e.stopPropagation();
    if (sharingCard) return;
    try {
      setSharingCard(true);
      setCardPreviewUrl(null);
      shareCardFileRef.current = null;
      const blob = await generateShareCardBlob(storyData);
      if (!blob) throw new Error('No blob');
      const file = new File([blob], 'invitation-card.png', { type: 'image/png' });
      shareCardFileRef.current = file;
      const textWithLink = `${title}${description ? `\n\n${description}` : ''}\n\n🔗 ${shareUrl}`;
      const result = await shareNativeOrFallback({
        file,
        title,
        text: textWithLink,
        url: shareUrl,
        skipExternalFallback: true
      });
      if (result === 'native' || result === 'aborted') {
        shareCardFileRef.current = null;
        return;
      }
      setCardPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share error:', err);
    } finally {
      setSharingCard(false);
    }
  };

  const closeCardPreview = () => {
    if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
    setCardPreviewUrl(null);
    shareCardFileRef.current = null;
  };

  const handleShareFromCardPreview = async (e) => {
    e.stopPropagation();
    const file = shareCardFileRef.current;
    const textWithLink = `${title}${description ? `\n\n${description}` : ''}\n\n🔗 ${shareUrl}`;
    await shareNativeOrFallback({
      file,
      title,
      text: textWithLink,
      url: shareUrl,
      skipExternalFallback: false
    });
  };

  /** Share invitation on the main home feed (communityPosts), not business featured slides. */
  const handleShareToFeed = (e) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      goToLogin({ returnPath: '/posts-feed' });
      return;
    }
    if (userProfile?.role === 'guest' || userProfile?.isGuest) {
      showToast(t('guests_cannot_post', { defaultValue: 'Sign in to share to the feed.' }), 'error');
      return;
    }
    const attachment = buildInvitationFeedAttachment(invitation);
    if (!attachment) return;
    navigate('/posts-feed', { state: { attachedInvitation: attachment, scrollToComposer: true } });
  };

  // Determine media to display (non–selfie-video cards only — video invites use split layout + `<video>`)
  const cardMedia = {
    type: isVideo ? 'video' : 'image',
    url: isVideo ?
    customVideo :
    pickSafeDisplayImageUrl(customImage, restaurantImage, image) || INVITATION_CARD_IMAGE_FALLBACK
  };

  const videoPosterUrl = pickSafeDisplayImageUrl(videoThumbnail, customImage, restaurantImage, image) || undefined;

  const formatVideoDuration = (sec) => {
    if (!Number.isFinite(sec) || sec <= 0) return '';
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isPhotoBottom = cardVariant === 'photoBottom';
  const isPhotoGlass = cardVariant === 'photoGlass';
  const isPhotoChips = cardVariant === 'photoChips';
  const isHeaderBodyLayout = templateKey === 'classic';

  const CARD_HERO_ASPECT_CSS = { hero_4_5: '4 / 5', hero_1_1: '4 / 5', hero_9_16: '4 / 5' };
  const cardHeroAspect = CARD_HERO_ASPECT_CSS[templateKey] || null;
  const accentColor = templateStyles.layout?.accentColor || '#f59e0b';
  const accentGlow = `${accentColor}55`;

  const chipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9999,
    background: 'rgba(0,0,0,0.42)',
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 700
  };

  const bottomMetaPillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#fff',
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };

  const cardFrameStyle = {
    ...templateStyles.card,
    position: 'relative',
    cursor: 'pointer',
    minHeight: cardHeroAspect ? 'auto' : '500px',
    display: 'flex',
    flexDirection: 'column',
    transformOrigin: 'center bottom',
    marginBottom: '16px',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    border: `1.5px solid ${accentColor}66`,
    boxShadow: `${templateStyles.card?.boxShadow || '0 10px 30px rgba(0,0,0,0.15)'}, 0 0 0 1px ${accentColor}44, 0 0 22px ${accentGlow}`
  };

  const joinButtonEl =
  <button
    type="button"
    onClick={(e) => {e.stopPropagation();handleAction(e);}}
    style={{
      width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
      background: invitation.meetingStatus === 'completed' ?
      '#10b981' :
      !eligibility.eligible ?
      isHeaderBodyLayout ? '#e5e7eb' : 'rgba(255,255,255,0.15)' :
      templateStyles.button?.background || 'linear-gradient(135deg, var(--premium-orange), #eab308)',
      color: invitation.meetingStatus === 'completed' ?
      'white' :
      !eligibility.eligible ?
      isHeaderBodyLayout ? '#6b7280' : 'rgba(255,255,255,0.5)' :
      'white',
      fontWeight: '900', fontSize: '1.05rem', cursor: !eligibility.eligible && !isHost && invitation.meetingStatus !== 'completed' ? 'not-allowed' : 'pointer',
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
      boxShadow: !eligibility.eligible || invitation.meetingStatus === 'completed' ? 'none' : `0 8px 20px ${accentGlow}`,
      transition: 'all 0.3s ease',
      textTransform: 'uppercase', letterSpacing: '1px'
    }}
    disabled={!eligibility.eligible && !isHost && invitation.meetingStatus !== 'completed'}>

            {invitation.meetingStatus === 'completed' ? t('completed') :
    isHost ? t('manage_invitation') :
    isAccepted ? t('request_approved') :
    !eligibility.eligible ? t('invite_unavailable') : userProfile?.isGuest ? t('login_to_join', { defaultValue: 'Login to Join' }) : t('join_btn')}
        </button>;


  const hostBlock =
  <div
    role="presentation"
    onClick={(e) => {e.stopPropagation();handleAvatarClick(e);}}
    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>

            <div style={{ position: 'relative' }}>
                <UserAvatar
        user={author}
        alt={author?.name}
        style={{ width: 36, height: 36, boxShadow: '0 2px 8px rgba(0,0,0,0.35)', background: 'white' }} />

                {!isHost && !isFollowing && author?.role !== 'business' && userProfile?.role !== 'business' &&
      <button
        type="button"
        onClick={handleFollowClick}
        style={{
          position: 'absolute', bottom: '-2px', ...(isRTL ? { left: '-2px' } : { right: '-2px' }),
          width: '16px', height: '16px', borderRadius: '50%',
          background: 'var(--primary)',
          border: '2px solid white', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', padding: 0, cursor: 'pointer', zIndex: 26,
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>

                        <FaPlus />
                    </button>
      }
            </div>
            <AppText as="span" style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{author?.name}</AppText>
        </div>;


  const glassRow = (icon, label, withBorder = true) =>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 0',
      borderBottom: withBorder ? '1px solid rgba(255,255,255,0.14)' : 'none',
      color: '#fff',
      fontSize: '0.88rem',
      fontWeight: 600
    }}>

            <AppText as="span" style={{ width: 22, display: 'flex', justifyContent: 'center', opacity: 0.95 }}>{icon}</AppText>
            <AppText as="span" style={{ flex: 1 }}>{label}</AppText>
        </div>;


  const splitMetaRow = (icon, label, withBorder = true) =>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 0',
      borderBottom: withBorder ? '1px solid #e5e7eb' : 'none',
      color: '#111827',
      fontSize: '0.88rem',
      fontWeight: 600
    }}>

            <AppText as="span" style={{ width: 22, display: 'flex', justifyContent: 'center', color: '#6b7280' }}>{icon}</AppText>
            <AppText as="span" style={{ flex: 1 }}>{label}</AppText>
        </div>;


  const hostBlockLight =
  <div
    role="presentation"
    onClick={(e) => {e.stopPropagation();handleAvatarClick(e);}}
    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>

            <div style={{ position: 'relative' }}>
                <UserAvatar
        user={author}
        alt={author?.name}
        style={{ width: 36, height: 36, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', background: 'white' }} />

                {!isHost && !isFollowing && author?.role !== 'business' && userProfile?.role !== 'business' &&
      <button
        type="button"
        onClick={handleFollowClick}
        style={{
          position: 'absolute', bottom: '-2px', ...(isRTL ? { left: '-2px' } : { right: '-2px' }),
          width: '16px', height: '16px', borderRadius: '50%',
          background: 'var(--primary)',
          border: '2px solid white', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', padding: 0, cursor: 'pointer', zIndex: 26,
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>

                        <FaPlus />
                    </button>
      }
            </div>
            <AppText as="span" style={{ color: '#111827', fontWeight: 800, fontSize: '0.9rem' }}>{author?.name}</AppText>
        </div>;


  const videoInviteFrameStyle = {
    ...cardFrameStyle,
    overflow: 'visible',
    minHeight: 'auto',
    height: 'auto'
  };

  if (!isVideo && isHeaderBodyLayout) {
    const dateTimeLabel = `${formatInviteDate()}${formatInviteTime() ? ` • ${formatInviteTime()}` : ''}`;
    const infoPill = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      padding: '7px 11px',
      background: '#f3f4f6',
      color: '#1f2937',
      border: '1px solid #e5e7eb',
      fontWeight: 700,
      fontSize: '0.82rem',
      lineHeight: 1,
      whiteSpace: 'nowrap'
    };
    return (
      <div
        className="smart-invitation-card invitation-card--compact"
        onClick={() => navigate(`/invitation/${id}`)}
        style={{
          ...cardFrameStyle,
          background: '#fff',
          overflow: 'hidden',
          height: 'auto',
          minHeight: 'auto'
        }}>

                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#0b0b0b' }}>
                    <img src={cardMedia.url} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.08) 100%)' }} />
                    <div
            style={{
              position: 'absolute',
              top: 10,
              ...(isRTL ? { right: 10 } : { left: 10 }),
              zIndex: 3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: 999,
              padding: '3px 10px 3px 3px',
              maxWidth: '65%',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)'
            }}>

                        <UserAvatar
              user={author}
              alt={author?.name}
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                background: '#fff'
              }} />

                        <AppText as="span" style={{
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
                            {author?.name}
                        </AppText>
                    </div>
                    <div style={{
            position: 'absolute', top: 10, ...(isRTL ? { left: 10 } : { right: 10 }),
            background: 'rgba(255,255,255,0.9)', color: '#111827',
            borderRadius: 999, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800
          }}>
                        {t(`type_${type?.toLowerCase().replace(/ /g, '')}`, { defaultValue: type })}
                    </div>
                    <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 10,
              zIndex: 2,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center'
            }}>

                        <AppText as="span" style={{ ...infoPill, background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                            <FaCalendarAlt /> {dateTimeLabel}
                        </AppText>
                        {distanceMeta &&
            <AppText as="span" style={{ ...infoPill, background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                                <FaMapMarkerAlt /> {distanceMeta}
                            </AppText>
            }
                        <AppText as="span" style={{ ...infoPill, background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                            <FaUserFriends /> {guestsMeta}
                        </AppText>
                        <AppText as="span" style={{ ...infoPill, background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                            <FaMoneyBillWave /> {paymentLabel}
                        </AppText>
                    </div>
                </div>

                <div style={{ padding: '14px 16px 16px', color: '#111827', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <AppText as="h3" style={{ margin: '0', fontSize: '1.15rem', fontWeight: 900, color: '#111827', lineHeight: 1.35 }}>
                        {title}
                    </AppText>
                    {description &&
          <AppText as="p"
          style={{
            margin: '0',
            color: '#4b5563',
            fontSize: '0.9rem',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>

                            {description}
                        </AppText>
          }

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.88rem' }}>
                        <FaMapMarkerAlt style={{ color: '#ef4444' }} /> {location}
                    </div>

                    {joinButtonEl ?
          <div style={{ marginTop: 4 }}>{joinButtonEl}</div> :
          null}
                </div>
            </div>);

  }

  return (
    <div
      className={`smart-invitation-card${cardHeroAspect ? ' invitation-card--aspect-hero' : ''}`}
      onClick={() => navigate(`/invitation/${id}`)}
      style={cardFrameStyle}
      onMouseEnter={(e) => {
        if (window.innerWidth > 768) {
          e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
          e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.22), 0 0 0 1px ${accentColor}88, 0 0 30px ${accentGlow}`;
        }
      }}
      onMouseLeave={(e) => {
        if (window.innerWidth > 768) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = `${templateStyles.card?.boxShadow || '0 10px 30px rgba(0,0,0,0.15)'}, 0 0 0 1px ${accentColor}44, 0 0 22px ${accentGlow}`;
        }
      }}>

            {false && isVideo ?
      <>
                    <div style={{ position: 'relative', flex: '0 0 50%', minHeight: 248, background: '#0a0a0a' }}>
                        <video
            ref={videoRef}
            src={customVideo}
            poster={videoPosterUrl}
            playsInline
            loop
            muted={isMuted}
            preload="metadata"
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onLoadedMetadata={(e) => {
              const d = formatVideoDuration(e.target.duration);
              if (d) setVideoDurationLabel(d);
            }}
            onClick={(e) => {
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              v.paused ? (v.play(), setIsPlayingVideo(true)) : (v.pause(), setIsPlayingVideo(false));
            }} />

                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 38%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)', pointerEvents: 'none' }} />

                        <div style={{
            position: 'absolute', top: '16px', ...(isRTL ? { right: '16px' } : { left: '16px' }), zIndex: 10,
            background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
            padding: '4px 12px', borderRadius: '12px', color: 'white',
            fontSize: '0.75rem', fontWeight: '800', border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
                            {t(`type_${type?.toLowerCase().replace(/ /g, '')}`, { defaultValue: type })}
                        </div>

                        <div className="header-actions" style={{
            position: 'absolute', top: '16px', ...(isRTL ? { left: '16px' } : { right: '16px' }), zIndex: 10,
            display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end', maxWidth: 'min(100% - 32px, 420px)'
          }}>
                            {videoDurationLabel &&
            <AppText as="span"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 9999,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.28)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>

                                    <FaVideo size={12} aria-hidden /> {videoDurationLabel}
                                </AppText>
            }
                            <button type="button" onClick={(e) => {e.stopPropagation();const video = videoRef.current;if (video) {video.muted = !video.muted;setIsMuted(video.muted);}}} style={actionBtnStyle}>
                                {isMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                            </button>
                            <button type="button" onClick={handleShare} style={actionBtnStyle} title={t('share')}>
                                <FaShareAlt size={14} />
                            </button>
                            <button type="button" onClick={handleShareToFeed} style={actionBtnStyle} title={t('share_to_feed', { defaultValue: 'Share to feed' })}>
                                <FaBullhorn size={14} />
                            </button>
                            {!isHost && userProfile?.role !== 'guest' && !userProfile?.isGuest &&
            <button type="button" onClick={(e) => {e.stopPropagation();setShowReportModal(true);}} style={actionBtnStyle}>
                                    <FaFlag size={14} />
                                </button>
            }
                            {(userProfile?.role === 'admin' || userProfile?.email?.includes('admin') || userProfile?.email === 'info@dinebuddies.com.au' || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33') &&
            <button type="button" onClick={async (e) => {e.stopPropagation();if (window.confirm(t('confirm_delete'))) await deleteInvitation(id);}} style={{ ...actionBtnStyle, background: '#ef4444', borderColor: '#ef4444' }}>
                                    <FaTimes size={16} />
                                </button>
            }
                        </div>

                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 18px 16px', zIndex: 5 }}>
                            <AppText as="h3"
            style={{
              fontSize: templateStyles.layout?.titleSize || '1.35rem',
              fontWeight: 900,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.25,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)'
            }}>

                                {title}
                            </AppText>
                            {templateStyles.layout?.displayDescription !== false && description &&
            <AppText as="p"
            style={{
              margin: '8px 0 0',
              fontSize: '0.88rem',
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.95)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textShadow: '0 1px 8px rgba(0,0,0,0.45)'
            }}>

                                    {description}
                                </AppText>
            }
                        </div>
                    </div>

                    <div style={{ flex: '0 0 auto', background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: 200, borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
                        <div style={{ padding: '14px 18px 0' }}>{hostBlockLight}</div>
                        <div style={{ padding: '4px 18px 12px', flex: '0 0 auto' }}>
                            {splitMetaRow(<FaCalendarAlt />, `${formatInviteDate()} · ${formatInviteTime() || '—'}`, true)}
                            {splitMetaRow(<FaUserFriends />, guestsMeta, true)}
                            {splitMetaRow(<FaMoneyBillWave />, paymentLabel, true)}
                            {distanceMeta ? splitMetaRow(<FaMapMarkerAlt />, distanceMeta, false) : null}
                        </div>
                        {userProfile?.role === 'business' ? null : isHost ?
          <div style={{ padding: '0 18px 18px', flexShrink: 0 }}>{joinButtonEl}</div> :

          <div style={{
            padding: '0 18px 18px',
            display: 'flex',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 10,
            alignItems: 'stretch',
            flexShrink: 0
          }}>

                                <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/invitation/${id}`);
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: '#4b5563',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}>

                                    {t('decline')}
                                </button>
                                <div style={{ flex: 1.15, minWidth: 0 }}>{joinButtonEl}</div>
                            </div>
          }
                    </div>
                </> :

      <>
            <div
          style={{
            width: '100%',
            aspectRatio: cardHeroAspect || '1 / 1',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'inherit',
            flexShrink: 0
          }}>

            <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', borderRadius: 'inherit', background: '#000' }}>
                {isVideo ?
            <video
              ref={videoRef}
              src={customVideo}
              poster={videoPosterUrl}
              playsInline
              loop
              muted={isMuted}
              preload="metadata"
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onLoadedMetadata={(e) => {
                const d = formatVideoDuration(e.target.duration);
                if (d) setVideoDurationLabel(d);
              }} /> :


            <img src={cardMedia.url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(0,0,0,0.32)', pointerEvents: 'none', borderRadius: 'inherit' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 88, zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)', pointerEvents: 'none', borderRadius: 'inherit' }} />

            <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: 4 }}>
                <div style={{
              position: 'absolute', top: '16px', ...(isRTL ? { right: '16px' } : { left: '16px' }), zIndex: 10,
              background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
              padding: '4px 12px', borderRadius: '12px', color: 'white',
              fontSize: '0.75rem', fontWeight: '800', border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
                    {t(`type_${type?.toLowerCase().replace(/ /g, '')}`, { defaultValue: type })}
                </div>

                <div className="header-actions" style={{
              position: 'absolute', top: '16px', ...(isRTL ? { left: '16px' } : { right: '16px' }), zIndex: 10,
              display: 'flex', gap: '8px'
            }}>
                    {isVideo && videoDurationLabel &&
              <AppText as="span"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 9999,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 800
              }}>

                            <FaVideo size={12} aria-hidden /> {videoDurationLabel}
                        </AppText>
              }
                    {isVideo &&
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const video = videoRef.current;
                  if (video) {
                    video.muted = !video.muted;
                    setIsMuted(video.muted);
                  }
                }}
                style={actionBtnStyle}>

                            {isMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                        </button>
              }
                    <button type="button" onClick={handleShare} style={actionBtnStyle} title={t('share')}>
                        <FaShareAlt size={14} />
                    </button>
                    <button type="button" onClick={handleShareToFeed} style={actionBtnStyle} title={t('share_to_feed', { defaultValue: 'Share to feed' })}>
                        <FaBullhorn size={14} />
                    </button>
                    {!isHost && userProfile?.role !== 'guest' && !userProfile?.isGuest &&
              <button type="button" onClick={(e) => {e.stopPropagation();setShowReportModal(true);}} style={actionBtnStyle}>
                            <FaFlag size={14} />
                        </button>
              }
                    {(userProfile?.role === 'admin' || userProfile?.email?.includes('admin') || userProfile?.email === 'info@dinebuddies.com.au' || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33') &&
              <button type="button" onClick={async (e) => {e.stopPropagation();if (window.confirm(t('confirm_delete'))) await deleteInvitation(id);}} style={{ ...actionBtnStyle, background: '#ef4444', borderColor: '#ef4444' }}>
                            <FaTimes size={16} />
                        </button>
              }
                </div>

                <div style={{
              padding: isPhotoBottom ? '56px 18px 0' : '52px 18px 0',
              textAlign: isPhotoBottom ? 'left' : 'center',
              fontFamily: templateStyles.layout?.fontFamily || 'inherit'
            }}>
                    <AppText as="h3"
              style={{
                fontSize: templateStyles.layout?.titleSize || '1.35rem',
                fontWeight: 900,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.25,
                textShadow: '0 2px 12px rgba(0,0,0,0.45)'
              }}>

                        {title}
                    </AppText>
                    {templateStyles.layout?.displayDescription !== false && description &&
              <AppText as="p"
              style={{
                margin: '8px 0 0',
                fontSize: '0.88rem',
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.9)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textShadow: '0 1px 8px rgba(0,0,0,0.5)'
              }}>

                            {description}
                        </AppText>
              }
                </div>

                <div style={{ flex: 1 }} />

                {isPhotoBottom &&
            <div style={{
              padding: '18px 18px 16px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
              borderRadius: '0 0 24px 24px'
            }}>
                        {hostBlock}
                        <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaCalendarAlt style={{ opacity: 0.92 }} />
                                    {formatInviteDate()}
                                </AppText>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaClock style={{ opacity: 0.92 }} />
                                    {formatInviteTime() || '—'}
                                </AppText>
                                {distanceMeta &&
                  <AppText as="span" style={bottomMetaPillStyle}>
                                        <FaMapMarkerAlt style={{ opacity: 0.92 }} />
                                        {distanceMeta}
                                    </AppText>
                  }
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaUserFriends style={{ opacity: 0.92 }} />
                                    {guestsMeta}
                                </AppText>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaMoneyBillWave style={{ opacity: 0.92 }} />
                                    {paymentLabel}
                                </AppText>
                            </div>
                        </div>
                        {joinButtonEl && <div style={{ marginTop: 12 }}>{joinButtonEl}</div>}
                    </div>
            }

                {isPhotoGlass &&
            <div style={{ padding: '8px 16px 16px' }}>
                        <div style={{
                borderRadius: 16,
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.28)',
                padding: '10px'
              }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaCalendarAlt style={{ opacity: 0.92 }} />
                                    {formatInviteDate()}
                                </AppText>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaClock style={{ opacity: 0.92 }} />
                                    {formatInviteTime() || '—'}
                                </AppText>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaUserFriends style={{ opacity: 0.92 }} />
                                    {guestsMeta}
                                </AppText>
                                <AppText as="span" style={bottomMetaPillStyle}>
                                    <FaMoneyBillWave style={{ opacity: 0.92 }} />
                                    {paymentLabel}
                                </AppText>
                                <AppText as="span" style={{ ...bottomMetaPillStyle, maxWidth: '100%' }}>
                                    <FaMapMarkerAlt style={{ opacity: 0.92 }} />
                                    <AppText as="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {distanceMeta || location || t('tbd', { defaultValue: 'TBD' })}
                                    </AppText>
                                </AppText>
                            </div>
                        </div>
                        <div style={{ marginTop: 12 }}>{hostBlock}</div>
                        {joinButtonEl && <div style={{ marginTop: 10 }}>{joinButtonEl}</div>}
                    </div>
            }

                {isPhotoChips &&
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                            <AppText as="span" style={chipStyle}><FaCalendarAlt style={{ marginRight: 6, opacity: 0.9 }} />{formatInviteDate()}</AppText>
                            <AppText as="span" style={chipStyle}><FaClock style={{ marginRight: 6, opacity: 0.9 }} />{formatInviteTime() || '—'}</AppText>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                            <AppText as="span" style={chipStyle}><FaUserFriends style={{ marginRight: 6, opacity: 0.9 }} />{guestsMeta}</AppText>
                            <AppText as="span" style={chipStyle}><FaMoneyBillWave style={{ marginRight: 6, opacity: 0.9 }} />{paymentLabel}</AppText>
                        </div>
                        {(distanceMeta || location) &&
              <AppText as="span" style={chipStyle}><FaMapMarkerAlt style={{ marginRight: 6, opacity: 0.9 }} />{distanceMeta || location}</AppText>
              }
                        <div style={{ alignSelf: 'stretch', marginTop: 4 }}>{hostBlock}</div>
                        {joinButtonEl && <div style={{ alignSelf: 'stretch', marginTop: 6 }}>{joinButtonEl}</div>}
                    </div>
            }
            </div>
            </div>
            </>
      }

            {/* Desktop fallback: card preview + share + download */}
            {cardPreviewUrl &&
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={closeCardPreview}>

                    <div
          style={{ width: 320, padding: 16, borderRadius: 20, background: '#111', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
          onClick={(e) => e.stopPropagation()}>

                        <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                            <img src={cardPreviewUrl} alt="Share Card" style={{ width: '100%', borderRadius: 10, display: 'block', cursor: 'pointer' }} />
                        </a>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
              type="button"
              onClick={handleShareFromCardPreview}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>

                                <FaShareAlt size={14} /> {t('share', { defaultValue: 'Share' })}
                            </button>
                            <a
              href={cardPreviewUrl}
              download="invitation-card.png"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>

                                {t('download', { defaultValue: 'Download' })}
                            </a>
                        </div>
                        <button
            type="button"
            onClick={closeCardPreview}
            style={{ width: '100%', marginTop: 8, padding: '8px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem' }}>

                            {t('close')}
                        </button>
                    </div>
                </div>
      }

            {/* Report Modal */}
            {showReportModal &&
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
                    <NewReportModal
          key={Date.now()}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportType="invitation"
          targetId={id}
          targetName={title}
          onSubmit={submitReport} />

                </div>
      }
        </div>);

};

export default InvitationCard;