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
import { getTemplateStyle } from '../utils/invitationTemplates';
import { formatAgeGroupsSmart } from '../utils/invitationDisplayUtils';
import { getSafeAvatar } from '../utils/avatarUtils';
import { generateShareCardBlob } from '../utils/shareCardCanvas';

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
                boxShadow: templateStyles.card.boxShadow || '0 8px 32px rgba(0,0,0,0.4)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                border: templateStyles.card.border || '1px solid rgba(255,255,255,0.1)',
                height: (templateStyles.card.minHeight || 'auto'),
                minHeight: '450px',
                background: 'var(--bg-card)'
            }}
            onMouseEnter={(e) => {
                if (window.innerWidth > 768) {
                    e.currentTarget.style.transform = 'translateY(-5px) scale(1.01)';
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.6)';
                }
            }}
            onMouseLeave={(e) => {
                if (window.innerWidth > 768) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = templateStyles.card.boxShadow || '0 8px 32px rgba(0,0,0,0.4)';
                }
            }}
        >
            {/* --- BACKGROUND PATTERN OVERLAY --- */}
            {templateStyles.layout?.backgroundOverlay && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    backgroundImage: templateStyles.layout.backgroundOverlay,
                    opacity: 0.4,
                    pointerEvents: 'none'
                }} />
            )}
            {/* --- 1. HEADER (User Info & Top Actions) --- */}
            <div className="card-header" style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                padding: '16px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                pointerEvents: 'none'
            }}>
                {/* Host Profile */}
                <div className="header-host-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }} onClick={handleAvatarClick}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={getSafeAvatar(author)}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = getSafeAvatar(null);
                            }}
                            alt={author?.name}
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                border: '2px solid rgba(255,255,255,0.9)', objectFit: 'cover'
                            }}
                        />
                        {!isHost && author?.role !== 'business' && userProfile?.role !== 'business' && (
                            <button
                                onClick={handleFollowClick}
                                style={{
                                    position: 'absolute', bottom: '-2px', right: '-2px',
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    background: isFollowing ? '#10b981' : '#ef4444', border: '1.5px solid white',
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0,
                                    cursor: 'pointer'
                                }}>
                                {isFollowing ? <FaCheck /> : <FaPlus />}
                            </button>
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                            {author?.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '6px' }}>
                                {t(`type_${type?.toLowerCase().replace(/ /g, '_')}`, { defaultValue: type })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Top Actions */}
                <div className="header-actions" style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '8px',
                    pointerEvents: 'auto',
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 30,
                    margin: 0,
                    padding: 0
                }}>
                    {/* Audio toggle */}
                    {cardMedia.type === 'video' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const video = window[`video_${id}`];
                                if (video) {
                                    video.muted = !video.muted;
                                    setIsMuted(video.muted);
                                }
                            }}
                            className="audio-btn"
                            style={actionBtnStyle}
                        >
                            {isMuted ? <FaVolumeMute size={15} /> : <FaVolumeUp size={15} />}
                        </button>
                    )}

                    {/* Share - Keep for guests to promote viral loop */}
                    <button onClick={handleShare} className="share-btn" style={actionBtnStyle}>
                        <FaShareAlt size={15} />
                    </button>

                    {/* Promote to Feed (New Feature) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/create-post', { state: { attachedInvitation: invitation } });
                        }}
                        className="promote-btn"
                        style={actionBtnStyle}
                        title={t('share_to_feed', { defaultValue: 'Share to Feed' })}
                    >
                        <FaBullhorn size={15} />
                    </button>

                    {/* Report - Hide for guest */}
                    {!isHost && userProfile?.role !== 'guest' && !userProfile?.isGuest && (
                        <button onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }} className="report-btn" style={actionBtnStyle}>
                            <FaFlag size={14} />
                        </button>
                    )}

                    {/* ADMIN DELETE BUTTON */}
                    {(
                        userProfile?.role === 'admin' ||
                        userProfile?.email?.includes('admin') ||
                        userProfile?.email === 'info@dinebuddies.com.au' ||
                        currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33'
                    ) && (
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm('🗑️ ADMIN ACTION: Delete this invitation permanently?')) {
                                        try {
                                            await deleteInvitation(id);
                                        } catch (err) {
                                            showToast('Error deleting: ' + err.message, 'error');
                                        }
                                    }
                                }}
                                className="delete-btn"
                                style={{ ...actionBtnStyle, background: '#ef4444', borderColor: '#ef4444' }}
                                title="Delete Invitation (Admin)"
                            >
                                <span style={{ fontWeight: 'bold', fontSize: '18px' }}>×</span>
                            </button>
                        )}
                </div>
            </div>

            {/* --- 2. MEDIA (Background on Desktop, Middle on Mobile) --- */}
            <div className="card-media" style={{
                position: 'absolute', inset: 0, zIndex: 0,
                background: '#000'
            }}>
                {cardMedia.type === 'video' ? (
                    <video
                        ref={(el) => {
                            if (el && !el.dataset.initialized) {
                                el.dataset.initialized = 'true';
                                window[`video_${id}`] = el;
                            }
                        }}
                        src={cardMedia.url}
                        poster={cardMedia.thumbnail || cardMedia.url}
                        playsInline
                        loop
                        autoPlay
                        muted={isMuted}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const video = e.target;
                            video.paused ? (video.play(), setIsPlayingVideo(true)) : (video.pause(), setIsPlayingVideo(false));
                        }}
                    />
                ) : (
                    <img
                        src={cardMedia.url}
                        alt={title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                    />
                )}
                {/* Overlay Gradient */}
                <div className="media-overlay" style={{
                    position: 'absolute', inset: 0,
                    background: templateStyles.card.background?.includes('rgba(0,0,0')
                        ? 'linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.95) 100%)'
                        : 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.95) 100%)',
                    pointerEvents: 'none'
                }} />
            </div>

            {/* --- 3. FOOTER / BODY (Info & Main Actions) --- */}
            <div className="card-footer" style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                padding: '24px',
                display: 'flex', flexDirection: 'column', gap: '12px',
                pointerEvents: 'none',
                textAlign: templateStyles.layout?.textAlign || 'left',
                alignItems: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start'
            }}>
                {/* Title & Info */}
                <div className="footer-info" style={{ pointerEvents: 'auto', width: '100%' }}>
                    {/* Decorative Header (Optional) */}
                    {templateStyles.layout?.decorativeElement && (
                        <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
                            {templateStyles.layout.decorativeElement}
                        </div>
                    )}

                    {/* Date & Time Row - More prominent */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '8px'
                    }}>
                        <span className="meta-badge" style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(255,255,255,0.2)', padding: '5px 12px',
                            borderRadius: '10px', fontSize: '0.85rem', color: 'white',
                            fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <FaCalendarAlt style={{ color: templateStyles.layout?.accentColor || '#fbbf24' }} />
                            {(() => {
                                if (!date) return 'TBD';
                                const d = new Date(date);
                                return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : undefined, { month: 'short', day: 'numeric' });
                            })()}
                        </span>
                        <span className="meta-badge" style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(255,255,255,0.2)', padding: '5px 12px',
                            borderRadius: '10px', fontSize: '0.85rem', color: 'white',
                            fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <FaClock style={{ color: templateStyles.layout?.accentColor || '#fbbf24' }} /> {time}
                        </span>
                        {occasionType && (
                            <span className="meta-badge" style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(255,255,255,0.2)', padding: '5px 12px',
                                borderRadius: '10px', fontSize: '0.85rem', color: 'white',
                                fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                {occasionType === 'romantic' ? <FaHeart style={{ color: '#ec4899' }} /> :
                                    occasionType === 'family' ? <FaUsers style={{ color: '#10b981' }} /> :
                                        occasionType === 'business' ? <FaBriefcase style={{ color: '#a855f7' }} /> :
                                            <FaSmile style={{ color: '#f59e0b' }} />}
                                {t(`occasion_${occasionType?.toLowerCase?.()}`, { defaultValue: occasionType })}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: templateStyles.layout?.titleSize || '1.4rem',
                        fontWeight: '900',
                        color: 'white',
                        margin: '0 0 10px 0',
                        lineHeight: 1.2,
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        fontFamily: templateStyles.layout?.fontFamily || 'inherit',
                        maxWidth: '100%'
                    }}>
                        {title}
                    </h3>

                    {/* Message / Description (New) */}
                    {templateStyles.layout?.displayDescription && description && (
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.9)',
                            margin: '0 0 15px 0',
                            lineHeight: '1.4',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            ...templateStyles.layout.messageStyle
                        }}>
                            {description}
                        </p>
                    )}

                    {/* Location / Restaurant */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start',
                        gap: '6px',
                        fontSize: '0.95rem',
                        color: 'white',
                        fontWeight: '700',
                        marginBottom: '10px'
                    }}>
                        <FaMapMarkerAlt style={{ color: '#f87171' }} />
                        <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '280px',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                        }}>
                            {location || t('venue_selected')}
                        </span>
                    </div>

                    {/* Secondary Info Row (Distance, Spots, etc.) */}
                    {templateStyles.layout?.showSecondaryInfo && (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            opacity: 0.85
                        }}>
                            {invitation.distance !== null && invitation.distance !== undefined && (
                                <span style={{ fontSize: '0.8rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <FaMapMarkerAlt /> {invitation.distance.toFixed(1)} km
                                </span>
                            )}
                            <span style={{ fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FaUserFriends /> {spotsLeft}
                            </span>
                        </div>
                    )}
                </div>

                {/* Primary Action Button */}
                {userProfile?.role !== 'business' && (
                    <div className="footer-actions" style={{ pointerEvents: 'auto', width: '100%' }}>
                        <button
                            onClick={handleAction}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                                background: invitation.meetingStatus === 'completed'
                                    ? '#10b981'
                                    : !eligibility.eligible ? '#374151' : (templateStyles.button?.background || 'var(--premium-orange, #f97316)'),
                                color: invitation.meetingStatus === 'completed' ? 'white' : !eligibility.eligible ? '#9ca3af' : 'white',
                                fontWeight: '900', fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                transition: 'all 0.3s ease',
                                textTransform: templateStyles.button?.textTransform || 'none',
                                letterSpacing: templateStyles.button?.letterSpacing || 'normal'
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
