import React from 'react';
import { FaMapMarkerAlt, FaUserFriends, FaMoneyBillWave, FaClock, FaCalendarAlt, FaChevronRight, FaPaperPlane, FaPlus, FaCheck } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useNavigate } from 'react-router-dom';
import ShareButtons from './ShareButtons';

const InvitationCard = ({ invitation }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, requestToJoin, cancelRequest, toggleFollow } = useInvitations();
    const { id, author, title, type, location, paymentType, guestsNeeded, joined = [], requests = [], date, image, time } = invitation;

    const isHost = author?.id === currentUser?.id;
    const isPending = (requests || []).includes(currentUser?.id);
    const isAccepted = (joined || []).includes(currentUser?.id);
    const spotsLeft = Math.max(0, guestsNeeded - (joined || []).length);
    const isFollowing = currentUser.following?.includes(author?.id);

    const handleAction = (e) => {
        e.stopPropagation();
        if (isHost || isAccepted) {
            navigate(`/invitation/${id}`);
        } else if (isPending) {
            cancelRequest(id);
        } else if (spotsLeft > 0) {
            navigate(`/invitation/${id}`);
        }
    };

    const handleFollowClick = (e) => {
        e.stopPropagation();
        toggleFollow(author?.id);
    };

    const handleAvatarClick = (e) => {
        e.stopPropagation();
        navigate(`/profile/${author?.id}`);
    };

    // Check if user meets invitation requirements
    const checkEligibility = () => {
        // Check gender preference
        if (invitation.genderPreference && invitation.genderPreference !== 'any') {
            if (currentUser.gender !== invitation.genderPreference) {
                return {
                    eligible: false,
                    reason: i18n.language === 'ar'
                        ? `هذه الدعوة مخصصة ${invitation.genderPreference === 'male' ? 'للذكور' : 'للإناث'} فقط`
                        : `This invitation is for ${invitation.genderPreference === 'male' ? 'males' : 'females'} only`
                };
            }
        }

        // Check age range
        if (invitation.ageRange && invitation.ageRange !== 'any' && currentUser.age) {
            const userAge = currentUser.age;
            let minAge, maxAge;

            if (invitation.ageRange === '18-25') {
                minAge = 18; maxAge = 25;
            } else if (invitation.ageRange === '26-35') {
                minAge = 26; maxAge = 35;
            } else if (invitation.ageRange === '36-45') {
                minAge = 36; maxAge = 45;
            } else if (invitation.ageRange === '46+') {
                minAge = 46; maxAge = 999;
            }

            if (userAge < minAge || userAge > maxAge) {
                return {
                    eligible: false,
                    reason: i18n.language === 'ar'
                        ? `هذه الدعوة مخصصة للفئة العمرية ${invitation.ageRange}`
                        : `This invitation is for ages ${invitation.ageRange}`
                };
            }
        }

        return { eligible: true };
    };

    const eligibility = checkEligibility();

    // Default image if none provided
    const cardImage = image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    return (
        <div
            className="smart-invitation-card"
            onClick={() => navigate(`/invitation/${id}`)}
            style={{
                position: 'relative',
                cursor: 'pointer'
            }}
        >
            {/* Layer 1: Background Image - الطبقة الأولى: صورة الخلفية */}
            <div
                className="card-bg-image"
                style={{
                    backgroundImage: `url(${cardImage})`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 'var(--radius-lg)',
                    zIndex: 1
                }}
            >
                {/* Layer 2: Gradient Overlay - الطبقة الثانية: التدرج */}
                <div
                    className="card-gradient-overlay"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)',
                        borderRadius: 'var(--radius-lg)',
                        zIndex: 2
                    }}
                ></div>
            </div>

            {/* Layer 3: Content Container - الطبقة الثالثة: المحتوى */}
            <div style={{ position: 'relative', zIndex: 3, padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>

                {/* Top Section: Avatar & Type Badge */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8rem'
                }}>
                    {/* Avatar Container with Follow Button */}
                    <div style={{ position: 'relative' }}>
                        {/* Avatar - Layer 4 */}
                        <div
                            onClick={handleAvatarClick}
                            style={{
                                width: '75px',
                                height: '75px',
                                borderRadius: '50%',
                                border: `3px solid ${isHost ? 'var(--luxury-gold)' : 'var(--primary)'}`,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                position: 'relative',
                                zIndex: 4,
                                background: 'var(--bg-card)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 0 25px rgba(139, 92, 246, 0.7)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <img
                                src={author?.avatar}
                                alt={author?.name}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                            {/* Online Status Indicator */}
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    right: '2px',
                                    width: '14px',
                                    height: '14px',
                                    background: '#10b981',
                                    border: '2px solid white',
                                    borderRadius: '50%',
                                    zIndex: 5
                                }}
                            ></div>
                        </div>

                        {/* Follow Button - Layer 5 (Highest) - زر دائري في الأسفل */}
                        {!isHost && (
                            <button
                                onClick={handleFollowClick}
                                style={{
                                    position: 'absolute',
                                    bottom: '-8px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    border: '2px solid white',
                                    background: isFollowing
                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: isFollowing
                                        ? '0 4px 12px rgba(16, 185, 129, 0.5)'
                                        : '0 4px 12px rgba(239, 68, 68, 0.5)',
                                    transition: 'all 0.3s ease',
                                    zIndex: 10,
                                    fontSize: '1rem',
                                    fontWeight: '900',
                                    padding: 0
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateX(-50%) scale(1.15)';
                                    e.currentTarget.style.boxShadow = isFollowing
                                        ? '0 6px 20px rgba(16, 185, 129, 0.7)'
                                        : '0 6px 20px rgba(239, 68, 68, 0.7)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                                    e.currentTarget.style.boxShadow = isFollowing
                                        ? '0 4px 12px rgba(16, 185, 129, 0.5)'
                                        : '0 4px 12px rgba(239, 68, 68, 0.5)';
                                }}
                            >
                                {isFollowing ? <FaCheck /> : <FaPlus />}
                            </button>
                        )}
                    </div>

                    {/* Author Name Badge - Next to Avatar */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(10px)',
                        padding: '8px 14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontSize: '0.85rem',
                        fontWeight: '800',
                        color: 'white',
                        whiteSpace: 'nowrap',
                        zIndex: 4
                    }}>
                        {author?.name}
                    </div>

                    {/* Type Badge */}
                    <div
                        style={{
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            color: 'white',
                            zIndex: 4
                        }}
                    >
                        {t(`type_${type?.toLowerCase().replace(/ /g, '_')}`) || type}
                    </div>
                </div>

                {/* Bottom Section: Info */}
                <div>
                    {/* Title & Location */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h3
                            style={{
                                fontSize: '1.65rem',
                                fontWeight: '900',
                                lineHeight: '1.2',
                                marginBottom: '0.5rem',
                                color: 'white',
                                textShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                        >
                            {title}
                        </h3>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: '0.9rem'
                            }}
                        >
                            <FaMapMarkerAlt style={{ color: 'var(--luxury-gold)', fontSize: '0.85rem' }} />
                            <span style={{ fontWeight: '500' }}>{location}</span>
                        </div>
                    </div>

                    {/* Meta Info Pills */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px',
                            marginBottom: '1.25rem'
                        }}
                    >
                        <div
                            style={{
                                background: 'rgba(139, 92, 246, 0.2)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                padding: '8px 10px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: 'white'
                            }}
                        >
                            <FaCalendarAlt style={{ fontSize: '0.7rem' }} />
                            <span>{date ? new Date(date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' }) : '---'}</span>
                        </div>
                        <div
                            style={{
                                background: 'rgba(139, 92, 246, 0.2)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                padding: '8px 10px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: 'white'
                            }}
                        >
                            <FaClock style={{ fontSize: '0.7rem' }} />
                            <span>{time || '20:30'}</span>
                        </div>
                        <div
                            style={{
                                background: 'rgba(251, 191, 36, 0.2)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(251, 191, 36, 0.4)',
                                padding: '8px 10px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: 'var(--luxury-gold)'
                            }}
                        >
                            <FaMoneyBillWave style={{ fontSize: '0.7rem' }} />
                            <span>{t(`payment_${paymentType?.toLowerCase().split(' ')[0]}`) || paymentType}</span>
                        </div>
                    </div>

                    {/* Footer Stats - Updated Layout */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem'
                        }}
                    >
                        <div
                            style={{
                                background: 'rgba(244, 63, 94, 0.25)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(244, 63, 94, 0.4)',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                color: 'white'
                            }}
                        >
                            <FaUserFriends style={{ color: 'var(--secondary)', fontSize: '0.8rem' }} />
                            <span>{t('spots_remaining', { count: spotsLeft })}</span>
                        </div>

                        {/* Gender Preference Badge */}
                        {invitation.genderPreference && (
                            <div
                                style={{
                                    background: 'rgba(139, 92, 246, 0.25)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(139, 92, 246, 0.4)',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    color: 'white'
                                }}
                            >
                                <span>
                                    {invitation.genderPreference === 'male' ? '👨' :
                                        invitation.genderPreference === 'female' ? '👩' : '👥'}
                                </span>
                                <span>
                                    {i18n.language === 'ar'
                                        ? (invitation.genderPreference === 'male' ? 'ذكور' :
                                            invitation.genderPreference === 'female' ? 'إناث' : 'لا يهم')
                                        : (invitation.genderPreference === 'male' ? 'Male' :
                                            invitation.genderPreference === 'female' ? 'Female' : 'Any')}
                                </span>
                            </div>
                        )}

                        {/* Age Range Badge */}
                        {invitation.ageRange && invitation.ageRange !== 'any' && (
                            <div
                                style={{
                                    background: 'rgba(251, 191, 36, 0.25)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(251, 191, 36, 0.4)',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    color: 'var(--luxury-gold)'
                                }}
                            >
                                <span>
                                    {invitation.ageRange === '18-25' ? '🧒' :
                                        invitation.ageRange === '26-35' ? '👨' :
                                            invitation.ageRange === '36-45' ? '🧔' : '👴'}
                                </span>
                                <span>{invitation.ageRange}</span>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleAction}
                        disabled={!isHost && !isAccepted && !eligibility.eligible}
                        style={{
                            width: '100%',
                            height: '55px',
                            borderRadius: '16px',
                            fontSize: '1rem',
                            fontWeight: '900',
                            border: (isPending || !eligibility.eligible) ? '2px solid rgba(255,255,255,0.3)' : 'none',
                            background: !eligibility.eligible
                                ? 'rgba(239, 68, 68, 0.2)'
                                : (isPending
                                    ? 'transparent'
                                    : (isAccepted || isHost
                                        ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)'
                                        : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)')),
                            color: 'white',
                            cursor: (!isHost && !isAccepted && !eligibility.eligible) ? 'not-allowed' : 'pointer',
                            boxShadow: (isPending || !eligibility.eligible) ? 'none' : '0 8px 20px rgba(139, 92, 246, 0.4)',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            opacity: (!isHost && !isAccepted && !eligibility.eligible) ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!isPending && eligibility.eligible) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 12px 28px rgba(139, 92, 246, 0.5)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = (isPending || !eligibility.eligible) ? 'none' : '0 8px 20px rgba(139, 92, 246, 0.4)';
                        }}
                    >
                        {isHost ? (
                            <>
                                <FaChevronRight />
                                <span>{t('manage_invitation')}</span>
                            </>
                        ) : isAccepted ? (
                            <>
                                <FaPaperPlane />
                                <span>{t('request_approved')}</span>
                            </>
                        ) : !eligibility.eligible ? (
                            <span style={{ opacity: 0.9, fontSize: '0.85rem', textAlign: 'center' }}>
                                {eligibility.reason}
                            </span>
                        ) : isPending ? (
                            <span style={{ opacity: 0.7 }}>{t('request_pending')}</span>
                        ) : (
                            <span>{t('join_btn')}</span>
                        )}
                    </button>

                    {/* Share Buttons - at bottom of card */}
                    <ShareButtons
                        title={title}
                        description={`${location} • ${date ? new Date(date).toLocaleDateString() : ''}`}
                        url={`${window.location.origin}/invitation/${id}`}
                        type="invitation"
                    />
                </div>
            </div>
        </div>
    );
};

export default InvitationCard;
