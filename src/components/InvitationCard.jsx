import React, { useState } from 'react';
import { FaMapMarkerAlt, FaClock, FaCalendarAlt, FaChevronRight, FaPaperPlane, FaPlus, FaCheck, FaFlag, FaMars, FaVenus, FaVenusMars, FaGenderless, FaMoneyBillWave, FaUserFriends, FaShareAlt, FaPlay, FaVolumeUp, FaVolumeMute, FaBullhorn, FaHeart, FaUsers, FaBriefcase, FaSmile } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import ShareButtons from './ShareButtons';
import NewReportModal from './NewReportModal';
import VideoPlayer from './Shared/VideoPlayer';
import { getTemplateStyle, COLOR_SCHEMES } from '../utils/invitationTemplates';
import { formatAgeGroupsSmart } from '../utils/invitationDisplayUtils';
import { getSafeAvatar } from '../utils/avatarUtils';
import { generateShareCardBlob } from '../utils/shareCardCanvas';

const hexToRgba = (hex, opacity) => {
    if (!hex || !hex.startsWith('#')) return hex;
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const InvitationCard = ({ invitation }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, toggleFollow, submitReport, deleteInvitation } = useInvitations();
    const { userProfile } = useAuth();
    const { showToast } = useToast();
    const [showReportModal, setShowReportModal] = useState(false);
    const [sharingCard, setSharingCard] = useState(false);
    const [cardPreviewUrl, setCardPreviewUrl] = useState(null); // desktop fallback
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    const isRTL = i18n.language === 'ar' || i18n.language?.startsWith('ar');

    const {
        id, author, title, type, location, paymentType,
        guestsNeeded, joined = [], requests = [], date,
        image, time, description, genderPreference, ageRange,
        // NEW: Video fields
        mediaSource, mediaType, customVideo, videoThumbnail,
        customImage, restaurantImage, occasionType
    } = invitation;

    // Get template styles
    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    const themeColors = COLOR_SCHEMES[invitation.colorScheme || 'oceanBlue'] || COLOR_SCHEMES.oceanBlue;

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

    // Direct image share — generates card and opens native share sheet (Windows/Mobile)
    const handleShare = async (e) => {
        e.stopPropagation();
        if (sharingCard) return;
        try {
            setSharingCard(true);
            setCardPreviewUrl(null);
            const blob = await generateShareCardBlob(storyData);
            if (!blob) throw new Error('No blob');
            const file = new File([blob], 'invitation-card.png', { type: 'image/png' });
            const textWithLink = `${description || title}\n\n🔗 ${shareUrl}`;
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title, text: textWithLink, url: shareUrl });
            } else {
                // Desktop fallback: show preview
                setCardPreviewUrl(URL.createObjectURL(blob));
            }
        } catch (err) {
            if (err?.name !== 'AbortError') console.error('Share error:', err);
        } finally {
            setSharingCard(false);
        }
    };

    const shareUrl = `${window.location.origin}/invitation/${id}`;
    const storyData = {
        title,
        image: customImage || restaurantImage || image,
        description,
        date,
        time,
        location,
        maxGuests: guestsNeeded,
        hostName: author?.name,
        hostImage: getSafeAvatar(author),
    };

    // Determine media to display
    const isVideo = mediaType === 'video' && customVideo;
    const cardMedia = isVideo
        ? { type: 'video', url: customVideo, thumbnail: videoThumbnail }
        : {
            type: 'image',
            url: customImage || restaurantImage || image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };

    return (
        <div
            className="smart-invitation-card"
            onClick={() => navigate(`/invitation/${id}`)}
            style={{
                ...templateStyles.card,
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: templateStyles.card.boxShadow || '0 10px 30px rgba(0,0,0,0.15)',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                display: 'flex',
                flexDirection: 'column',
                height: (templateStyles.card.minHeight || 'auto'),
                minHeight: 'auto',
                transformOrigin: 'center bottom',
                marginBottom: '16px', // spacing between cards in feed
                padding: 0,
                border: `2px solid ${themeColors.primary}`,
                background: hexToRgba(themeColors.primary, 0.25),
                borderRadius: '24px',
            }}
            onMouseEnter={(e) => {
                if (window.innerWidth > 768) {
                    e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
                }
            }}
            onMouseLeave={(e) => {
                if (window.innerWidth > 768) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = templateStyles.card.boxShadow || '0 10px 30px rgba(0,0,0,0.15)';
                }
            }}
        >
            {/* --- BACKGROUND PATTERN OVERLAY --- */}
            {templateStyles.layout?.backgroundOverlay && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1, backgroundImage: templateStyles.layout.backgroundOverlay,
                    opacity: 0.1, pointerEvents: 'none'
                }} />
            )}

            {/* --- SECTION 1: TICKET ARTWORK (Top 180px) --- */}
            <div className="ticket-artwork" style={{
                position: 'relative', height: '180px', flexShrink: 0, overflow: 'hidden', zIndex: 2
            }}>
                {cardMedia.type === 'video' ? (
                    <video
                        ref={(el) => {
                            if (el && !el.dataset.initialized) {
                                el.dataset.initialized = 'true';
                                window[`video_${id}`] = el;
                            }
                        }}
                        src={cardMedia.url} poster={cardMedia.thumbnail || cardMedia.url}
                        playsInline loop autoPlay muted={isMuted}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const video = e.target;
                            video.paused ? (video.play(), setIsPlayingVideo(true)) : (video.pause(), setIsPlayingVideo(false));
                        }}
                    />
                ) : (
                    <img src={cardMedia.url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}

                {/* Subtile top gradient for button readability */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '80px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                    pointerEvents: 'none'
                }} />

                {/* Top Left: Type Badge */}
                <div style={{
                    position: 'absolute', top: '16px', ...(isRTL ? { right: '16px' } : { left: '16px' }), zIndex: 10,
                    background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                    padding: '4px 12px', borderRadius: '12px', color: 'white',
                    fontSize: '0.75rem', fontWeight: '800', border: '1px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                    {t(`type_${type?.toLowerCase().replace(/ /g, '')}`, { defaultValue: type })}
                </div>

                {/* Top Right: Actions */}
                <div className="header-actions" style={{
                    position: 'absolute', top: '16px', ...(isRTL ? { left: '16px' } : { right: '16px' }), zIndex: 10,
                    display: 'flex', gap: '8px'
                }}>
                    {cardMedia.type === 'video' && (
                        <button onClick={(e) => { e.stopPropagation(); const video = window[`video_${id}`]; if (video) { video.muted = !video.muted; setIsMuted(video.muted); } }} style={actionBtnStyle}>
                            {isMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                        </button>
                    )}
                    <button onClick={handleShare} style={actionBtnStyle} title={t('share')}>
                        <FaShareAlt size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/create-post', { state: { attachedInvitation: invitation } }); }} style={actionBtnStyle} title={t('share_to_feed')}>
                        <FaBullhorn size={14} />
                    </button>
                    {!isHost && userProfile?.role !== 'guest' && !userProfile?.isGuest && (
                        <button onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }} style={actionBtnStyle}>
                            <FaFlag size={14} />
                        </button>
                    )}
                    {(userProfile?.role === 'admin' || userProfile?.email?.includes('admin') || userProfile?.email === 'info@dinebuddies.com.au' || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33') && (
                        <button onClick={async (e) => { e.stopPropagation(); if (window.confirm(t('confirm_delete'))) await deleteInvitation(id); }} style={{ ...actionBtnStyle, background: '#ef4444', borderColor: '#ef4444' }}>
                            <FaTimes size={16} />
                        </button>
                    )}
                </div>

                {/* Subtile bottom gradient for host info readability */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '100px',
                    background: `linear-gradient(to top, ${hexToRgba(themeColors.primary, 0.85)} 0%, rgba(0,0,0,0.5) 70%, transparent 100%)`,
                    pointerEvents: 'none', zIndex: 5
                }} />

                {/* Host Info - Bottom Left of Ticket Artwork */}
                <div style={{ position: 'absolute', bottom: '12px', ...(isRTL ? { right: '16px' } : { left: '16px' }), zIndex: 25, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleAvatarClick}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={getSafeAvatar(author)}
                            onError={(e) => { e.target.onerror = null; e.target.src = getSafeAvatar(null); }}
                            alt={author?.name}
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover',
                                border: '2px solid white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                background: 'white'
                            }}
                        />
                        {!isHost && !isFollowing && author?.role !== 'business' && userProfile?.role !== 'business' && (
                            <button
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
                        )}
                    </div>
                    {/* Host Name over the image right next to avatar */}
                    <div style={{ color: 'white', fontWeight: '800', fontSize: '0.95rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', paddingInlineEnd: '8px' }}>
                        {author?.name}
                    </div>
                </div>
            </div>

            {/* --- SECTION 3: TICKET PAPER BODY (White/Dark Slate base) --- */}
            <div className="ticket-body" style={{
                background: 'transparent', flex: 1,
                padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 5,
                position: 'relative'
            }}>

                {/* Title */}
                <h3 style={{
                    fontSize: templateStyles.layout?.titleSize || '1.35rem',
                    fontWeight: '900', color: 'var(--text-main)', margin: '0',
                    lineHeight: 1.25, textAlign: 'center',
                    fontFamily: templateStyles.layout?.fontFamily || 'inherit'
                }}>
                    {title}
                </h3>

                {/* Description directly below Title */}
                {templateStyles.layout?.displayDescription !== false && description && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p style={{
                            margin: 0, fontSize: '0.85rem', lineHeight: '1.4',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                            {description}
                        </p>
                    </div>
                )}

                {/* Quick Details Badges (Date / Time / Occasion) */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '6px'
                }}>
                    <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'var(--bg-input)', padding: '4px 10px',
                        borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)',
                        fontWeight: '700', border: '1px solid var(--border-color)'
                    }}>
                        <FaCalendarAlt style={{ color: 'var(--primary)' }} />
                        {(() => {
                            if (!date) return 'TBD';
                            const d = new Date(date);
                            return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : undefined, { month: 'short', day: 'numeric' });
                        })()}
                    </span>
                    <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'var(--bg-input)', padding: '4px 10px',
                        borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)',
                        fontWeight: '700', border: '1px solid var(--border-color)'
                    }}>
                        <FaClock style={{ color: 'var(--primary)' }} /> {time}
                    </span>
                    {occasionType && (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: 'var(--bg-input)', padding: '4px 10px',
                            borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)',
                            fontWeight: '700', border: '1px solid var(--border-color)'
                        }}>
                            {occasionType === 'romantic' ? <FaHeart style={{ color: '#ec4899' }} /> :
                                occasionType === 'family' ? <FaUsers style={{ color: '#10b981' }} /> :
                                    occasionType === 'business' ? <FaBriefcase style={{ color: '#a855f7' }} /> :
                                        <FaSmile style={{ color: '#f59e0b' }} />}
                            {t(`occasion_${occasionType?.toLowerCase?.()}`, { defaultValue: occasionType })}
                        </span>
                    )}
                </div>

                <div style={{ flex: 1 }}></div>

                {/* Sub Metadata (Distance, Spots Needed) */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '16px', marginTop: 'auto', marginBottom: '4px'
                }}>
                    {invitation.distance !== null && invitation.distance !== undefined && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                            <FaMapMarkerAlt /> {invitation.distance.toFixed(1)} {t('km', { defaultValue: 'km' })}
                        </span>
                    )}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                        <FaUserFriends style={{ color: '#3b82f6' }} /> {spotsLeft} {t('spots_left', { defaultValue: 'Spots Left' })}
                    </span>
                </div>

                {/* Primary Join / Manage Button */}
                {userProfile?.role !== 'business' && (
                    <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                        <button
                            onClick={handleAction}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                                background: invitation.meetingStatus === 'completed'
                                    ? '#10b981'
                                    : !eligibility.eligible ? 'var(--bg-input)' : (templateStyles.button?.background || 'linear-gradient(135deg, var(--premium-orange), #eab308)'),
                                color: invitation.meetingStatus === 'completed' ? 'white' : !eligibility.eligible ? 'var(--text-muted)' : 'white',
                                fontWeight: '900', fontSize: '1.05rem', cursor: !eligibility.eligible && !isHost && invitation.meetingStatus !== 'completed' ? 'not-allowed' : 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                                boxShadow: (!eligibility.eligible || invitation.meetingStatus === 'completed') ? 'none' : '0 8px 20px rgba(249, 115, 22, 0.25)',
                                transition: 'all 0.3s ease',
                                textTransform: 'uppercase', letterSpacing: '1px'
                            }}
                            disabled={!eligibility.eligible && !isHost && invitation.meetingStatus !== 'completed'}
                        >
                            {invitation.meetingStatus === 'completed' ? t('completed') :
                                isHost ? t('manage_invitation') :
                                    isAccepted ? t('request_approved') :
                                        !eligibility.eligible ? t('invite_unavailable') : (userProfile?.isGuest ? t('login_to_join', { defaultValue: 'Login to Join' }) : t('join_btn'))}
                        </button>
                    </div>
                )}
            </div>

            {/* Desktop fallback: card preview + download */}
            {cardPreviewUrl && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => { URL.revokeObjectURL(cardPreviewUrl); setCardPreviewUrl(null); }}
                >
                    <div
                        style={{ width: 320, padding: 16, borderRadius: 20, background: '#111', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                            <img src={cardPreviewUrl} alt="Share Card" style={{ width: '100%', borderRadius: 10, display: 'block', cursor: 'pointer' }} />
                        </a>
                        <a
                            href={cardPreviewUrl}
                            download="invitation-card.png"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}
                        >
                            ⬇️ Download Card
                        </a>
                        <button
                            onClick={() => { URL.revokeObjectURL(cardPreviewUrl); setCardPreviewUrl(null); }}
                            style={{ width: '100%', marginTop: 8, padding: '8px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem' }}
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
                    <NewReportModal
                        key={Date.now()}
                        isOpen={showReportModal}
                        onClose={() => setShowReportModal(false)}
                        reportType="invitation"
                        targetId={id}
                        targetName={title}
                        onSubmit={submitReport}
                    />
                </div>
            )}
        </div>
    );
};

export default InvitationCard;
