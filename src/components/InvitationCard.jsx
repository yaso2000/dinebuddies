import React, { useState } from 'react';
import { FaMapMarkerAlt, FaClock, FaCalendarAlt, FaChevronRight, FaPaperPlane, FaPlus, FaCheck, FaFlag, FaMars, FaVenus, FaVenusMars, FaMoneyBillWave, FaUserFriends, FaShareAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useNavigate } from 'react-router-dom';
import ShareButtons from './ShareButtons';
import NewReportModal from './NewReportModal';

const InvitationCard = ({ invitation }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, toggleFollow, submitReport } = useInvitations();
    const [showReportModal, setShowReportModal] = useState(false);

    const {
        id, author, title, type, location, paymentType,
        guestsNeeded, joined = [], requests = [], date,
        image, time, description, genderPreference, ageRange
    } = invitation;

    const isHost = author?.id === currentUser?.id;
    const isPending = (requests || []).includes(currentUser?.id);
    const isAccepted = (joined || []).includes(currentUser?.id);
    const spotsLeft = Math.max(0, guestsNeeded - (joined || []).length);
    const isFollowing = currentUser.following?.includes(author?.id);
    // User app only - no partner checks needed

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
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `${title} at ${location}`,
                    url: `${window.location.origin}/invitation/${id}`,
                });
            } catch (err) {
                // User cancelled
            }
        } else {
            navigator.clipboard.writeText(`${window.location.origin}/invitation/${id}`);
            alert(t('link_copied_clipboard'));
        }
    };

    const cardImage = image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    return (
        <div
            className="smart-invitation-card"
            onClick={() => navigate(`/invitation/${id}`)}
            style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '380px', // Ensure height for content
                aspectRatio: '3/4', // Portrait-ish aspect ratio like stories
                border: '1px solid rgba(255,255,255,0.1)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px) scale(1.01)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.6)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
            }}
        >
            {/* 1. FULL BACKGROUND IMAGE */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <img
                    src={cardImage}
                    alt={title}
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transition: 'transform 0.5s ease' // Subtle zoom on hover effect
                    }}
                />

                {/* 2. REFINED OVERLAY (Clear Middle, Dark Bottom) */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 25%, transparent 50%, rgba(0,0,0,0.8) 75%, rgba(0,0,0,0.98) 100%)',
                }} />
            </div>

            {/* 3. CONTENT LAYER */}
            <div style={{
                position: 'relative', zIndex: 10, padding: '20px',
                flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>

                {/* Header: Host & Type */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative' }} onClick={handleAvatarClick}>
                            <img
                                src={author?.avatar}
                                alt={author?.name}
                                style={{
                                    width: '44px', height: '44px', borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.8)',
                                    objectFit: 'cover'
                                }}
                            />
                            {!isHost && author?.accountType !== 'business' && (
                                <button
                                    onClick={handleFollowClick}
                                    style={{
                                        position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: isFollowing ? '#10b981' : '#ef4444', border: '1.5px solid white',
                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0
                                    }}>
                                    {isFollowing ? <FaCheck /> : <FaPlus />}
                                </button>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{author?.name}</div>
                            <div style={{
                                fontSize: '0.7rem', color: 'rgba(255,255,255,0.9)',
                                background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px',
                                display: 'inline-block', marginTop: '4px', backdropFilter: 'blur(4px)'
                            }}>
                                {t(`type_${type?.toLowerCase().replace(/ /g, '_')}`, { defaultValue: type })}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleShare}
                            style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '50%', width: '30px', height: '30px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                            <FaShareAlt style={{ fontSize: '13px', opacity: 0.9 }} />
                        </button>
                        {!isHost && (
                            <button onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                                style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '50%', width: '30px', height: '30px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                                <FaFlag style={{ fontSize: '12px', opacity: 0.8 }} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Body: Title & Details (Pushed down by flex) */}
                <div style={{ marginTop: 'auto' }}>
                    <h3 style={{
                        fontSize: '1.5rem', fontWeight: '900', color: 'white',
                        marginBottom: '8px', lineHeight: '1.2',
                        textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                    }}>
                        {title}
                    </h3>

                    {/* Meta Row: Date | Time | Payment */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
                        marginBottom: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: '500'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FaCalendarAlt style={{ color: '#c084fc' }} />
                            <span>{date ? new Date(date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' }) : '--'}</span>
                        </div>
                        <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.4)' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FaClock style={{ color: '#c084fc' }} />
                            <span>{time}</span>
                        </div>
                        <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.4)' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FaMoneyBillWave style={{ color: '#fbbf24' }} />
                            <span>{t(`payment_${(paymentType || 'Split').toLowerCase().split(' ')[0]}`, { defaultValue: paymentType || 'Split' })}</span>
                        </div>
                    </div>

                    {/* Location */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: 'rgba(255,255,255,0.8)' }}>
                        <FaMapMarkerAlt style={{ color: '#f87171' }} />
                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {location || t('venue_selected')}
                        </span>
                    </div>

                    {/* Distance & Travel Time */}
                    {invitation.distance !== null && invitation.distance !== undefined && (
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            padding: '8px 12px',
                            marginBottom: '15px',
                            display: 'flex',
                            gap: '15px',
                            alignItems: 'center',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#10b981', fontWeight: '700' }}>
                                <span>📏</span>
                                <span style={{ color: 'white' }}>{invitation.distance.toFixed(1)} km</span>
                            </div>
                            <div style={{ width: '1px', height: '14px', background: 'rgba(16, 185, 129, 0.4)' }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#10b981', fontWeight: '700' }}>
                                <span>⏱️</span>
                                <span style={{ color: 'white' }}>~{Math.round((invitation.distance / 40) * 60)} {t('minutes')}</span>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions Row */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* Main Join Button */}
                        <button
                            className="invitation-action-btn"
                            onClick={handleAction}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '14px', border: 'none',
                                background: !eligibility.eligible ? 'rgba(55, 65, 81, 0.8)' : 'white',
                                color: !eligibility.eligible ? '#d1d5db' : 'black',
                                fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                transition: 'transform 0.2s',
                                backdropFilter: 'blur(5px)'
                            }}
                            disabled={!eligibility.eligible && !isHost}
                        >
                            {isHost ? t('manage_invitation') :
                                isAccepted ? t('request_approved') :
                                    !eligibility.eligible ? (eligibility.reason || t('invite_unavailable')) :
                                        isPending ? t('request_pending') : t('join_btn')}
                        </button>

                        {/* Quick Stats Box (Spots & Gender) */}
                        <div style={{
                            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                            borderRadius: '14px', padding: '0 12px', height: '45px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'white' }}>
                                <FaUserFriends style={{ opacity: 0.8 }} />
                                <span style={{ fontWeight: 'bold' }}>{spotsLeft}</span>
                            </div>
                            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }} />
                            <div style={{ fontSize: '1rem', color: 'white' }}>
                                {(!genderPreference || genderPreference === 'any') ? <FaVenusMars /> : genderPreference === 'male' ? <FaMars style={{ color: '#93c5fd' }} /> : <FaVenus style={{ color: '#f9a8d4' }} />}
                            </div>
                        </div>
                    </div>

                </div>
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
