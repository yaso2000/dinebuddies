import React, { useState } from 'react';
import { FaMapMarkerAlt, FaClock, FaCalendarAlt, FaChevronRight, FaPaperPlane, FaPlus, FaCheck, FaFlag, FaMars, FaVenus, FaVenusMars, FaMoneyBillWave, FaUserFriends, FaShareAlt, FaPlay, FaVolumeUp, FaVolumeMute, FaBullhorn } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ShareButtons from './ShareButtons';
import NewReportModal from './NewReportModal';
import VideoPlayer from './Shared/VideoPlayer';
import { getTemplateStyle } from '../utils/invitationTemplates';

const InvitationCard = ({ invitation }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, toggleFollow, submitReport } = useInvitations();
    const { userProfile } = useAuth(); // Get userProfile for accountType check
    const [showReportModal, setShowReportModal] = useState(false);
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    const {
        id, author, title, type, location, paymentType,
        guestsNeeded, joined = [], requests = [], date,
        image, time, description, genderPreference, ageRange,
        // NEW: Video fields
        mediaSource, mediaType, customVideo, videoThumbnail,
        customImage, restaurantImage
    } = invitation;

    // Get template styles
    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue'
    );

    const isHost = author?.id === currentUser?.id;
    const isPending = (requests || []).includes(currentUser?.id);
    const isAccepted = (joined || []).includes(currentUser?.id);
    const spotsLeft = Math.max(0, guestsNeeded - (joined || []).length);
    const isFollowing = currentUser.following?.includes(author?.id);

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
        if (userProfile?.accountType === 'business') {
            return { eligible: false, reason: t('business_cannot_join', { defaultValue: 'Business accounts cannot join invitations' }) };
        }

        // Check gender preference
        if (genderPreference && genderPreference !== 'any' && currentUser.gender !== genderPreference) {
            return { eligible: false, reason: t('gender_mismatch') };
        }

        // Check age range preference
        if (ageRange && currentUser.age) {
            const [minAge, maxAge] = ageRange.split('-').map(Number);
            const userAge = currentUser.age;
            if (userAge < minAge || userAge > maxAge) {
                return { eligible: false, reason: `${t('age_range_preference')}: ${ageRange}` };
            }
        }

        return { eligible: true };
    };
    const eligibility = checkEligibility();

    const handleShare = async (e) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/invitation/${id}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `${title} at ${location}`,
                    url: shareUrl,
                });
            } catch (err) {
                console.log('Share cancelled or failed:', err);
            }
        } else {
            // Fallback to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(shareUrl)
                    .then(() => alert(t('link_copied_clipboard')))
                    .catch(err => {
                        console.error('Clipboard failed:', err);
                        alert(t('share_manual', { url: shareUrl, defaultValue: `Share this link: ${shareUrl}` }));
                    });
            } else {
                // Fallback for non-secure contexts
                prompt(t('copy_link', { defaultValue: 'Copy this link:' }), shareUrl);
            }
        }
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
                            src={(author?.avatar && !author.avatar.includes('dicebear')) ? author.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(author?.name || 'User')}&background=random`}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(author?.name || 'User')}&background=random`;
                            }}
                            alt={author?.name}
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                border: '2px solid rgba(255,255,255,0.9)', objectFit: 'cover'
                            }}
                        />
                        {!isHost && author?.accountType !== 'business' && (
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
                    background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.95) 100%)',
                    pointerEvents: 'none'
                }} />
            </div>

            {/* --- 3. FOOTER / BODY (Info & Main Actions) --- */}
            <div className="card-footer" style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '10px',
                pointerEvents: 'none'
            }}>
                {/* Title & Info */}
                <div className="footer-info" style={{ pointerEvents: 'auto' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', margin: '0 0 8px 0', lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        {title}
                    </h3>

                    {/* Row 1: Time & Distance */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.85rem', color: 'white' }}>
                            <FaClock style={{ color: '#fbbf24' }} /> {time}
                        </span>

                        {invitation.distance !== null && invitation.distance !== undefined && (
                            <span className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.85rem', color: '#6ee7b7' }}>
                                <FaMapMarkerAlt />
                                <span>{invitation.distance.toFixed(1)} km</span>
                                <span style={{ opacity: 0.7, fontSize: '0.75em', marginLeft: '2px' }}>
                                    (~{Math.round((invitation.distance / 40) * 60)} min)
                                </span>
                            </span>
                        )}
                    </div>

                    {/* Row 2: Demographics (Spots, Gender, Age) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        {/* Spots */}
                        <span className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', color: 'white' }}>
                            <FaUserFriends style={{ color: '#60a5fa' }} /> {spotsLeft} {t('spots', { defaultValue: 'spots' })}
                        </span>

                        {/* Gender */}
                        <span className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', color: 'white' }}>
                            {(!genderPreference || genderPreference === 'any')
                                ? <><FaVenusMars style={{ color: '#a78bfa' }} /> {t('any', { defaultValue: 'Any' })}</>
                                : (genderPreference === 'male'
                                    ? <><FaMars style={{ color: '#60a5fa' }} /> {t('male', { defaultValue: 'Male' })}</>
                                    : <><FaVenus style={{ color: '#f472b6' }} /> {t('female', { defaultValue: 'Female' })}</>)
                            }
                        </span>

                        {/* Age Group - assuming invitation.ageRange exists, formatted like "18-25" */}
                        {invitation.ageRange && (
                            <span className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', color: 'white' }}>
                                <span>🔞 {invitation.ageRange}</span>
                            </span>
                        )}
                    </div>

                    {/* Location Text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                        <FaMapMarkerAlt style={{ color: '#f87171' }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                            {location || t('venue_selected')}
                        </span>
                    </div>
                </div>

                {/* Primary Action Button */}
                {userProfile?.accountType !== 'business' && (
                    <div className="footer-actions" style={{ pointerEvents: 'auto' }}>
                        <button
                            onClick={handleAction}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                                background: invitation.meetingStatus === 'completed'
                                    ? '#10b981'
                                    : !eligibility.eligible ? '#374151' : 'white',
                                color: invitation.meetingStatus === 'completed' ? 'white' : !eligibility.eligible ? '#9ca3af' : 'black',
                                fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
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
