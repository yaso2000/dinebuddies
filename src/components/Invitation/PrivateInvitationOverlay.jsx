import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotifications } from '../../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { FaEnvelopeOpen, FaArrowRight, FaTimes, FaLock, FaCalendarAlt, FaClock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { getTemplateStyle, OCCASION_PRESETS } from '../../utils/invitationTemplates';
import { getSafeAvatar } from '../../utils/avatarUtils';
import PrivateInvitationInfoGrid from './PrivateInvitationInfoGrid';
import Lottie from 'lottie-react';
import './PrivateInvitationOverlay.css';

const CATEGORY_ICONS = {
    Dating: ['❤️', '💖', '🌹', '✨', '💍'],
    Birthday: ['🎂', '🎉', '🎈', '🎁', '🎊'],
    Social: ['🥳', '🥂', '🍹', '✨', '🎈'],
    Work: ['💼', '📈', '✍️', '🤝', '🏢'],
    Nightlife: ['🎸', '🍸', '🎧', '🌌', '🕺'],
    Dining: ['🍽️', '🍷', '🥗', '🍕', '🍰'],
    Café: ['☕', '🥐', '🍪', '🍵', '🍩'],
    Gaming: ['🎮', '👾', '🎯', '⚔️', '🛡️']
};

const PrivateInvitationOverlay = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { activePrivateInvitation, markAsRead, setActivePrivateInvitation, dismissNotification, unreadPrivateInvitations } = useNotifications();
    const [invitation, setInvitation] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [animationData, setAnimationData] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [dragX, setDragX] = useState(0);
    const [slideDirection, setSlideDirection] = useState(null); // 'next' or 'prev'

    const occasionKey = invitation ? (invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase() : 'Social';
    const backgroundIcons = CATEGORY_ICONS[occasionKey] || CATEGORY_ICONS.Social;

    useEffect(() => {
        const fetchInvitation = async () => {
            if (activePrivateInvitation?.invitationId) {
                setLoading(true);
                try {
                    const docRef = doc(db, 'private_invitations', activePrivateInvitation.invitationId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setInvitation({ id: docSnap.id, ...docSnap.data() });
                        setIsOpen(false);
                        setIsTransitioning(false);
                    }
                } catch (error) {
                    console.error("Error fetching overlay invitation:", error);
                } finally {
                    setLoading(false);
                }
            } else if (activePrivateInvitation?.id?.startsWith('test-')) {
                setInvitation(activePrivateInvitation);
                setIsOpen(false);
                setIsTransitioning(false);
            } else {
                setInvitation(null);
                setIsOpen(false);
            }
        };

        // Add a slight delay before showing the next one
        if (activePrivateInvitation) {
            const timer = setTimeout(fetchInvitation, 600);
            return () => clearTimeout(timer);
        } else {
            setInvitation(null);
        }
    }, [activePrivateInvitation]);

    // Fetch Lottie data
    useEffect(() => {
        const lottieUrl = invitation ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.lottieUrl : null;
        if (lottieUrl) {
            fetch(lottieUrl)
                .then(res => res.json())
                .then(data => setAnimationData(data))
                .catch(err => console.error('Error loading Lottie animation:', err));
        } else {
            setAnimationData(null);
        }
    }, [invitation]);

    const [hostInfo, setHostInfo] = useState({ name: null, photo: null });

    useEffect(() => {
        const fetchHostData = async () => {
            // Priority: Notification profile fields > Firebase user doc > Invitation doc fields
            const hostId = activePrivateInvitation?.fromUserId || invitation?.fromUserId || invitation?.authorId;

            if (hostId) {
                try {
                    const userRef = doc(db, 'users', hostId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        setHostInfo({
                            name: userData.display_name || userData.name || activePrivateInvitation?.fromUserName || invitation?.fromUserName || invitation?.hostName || t('guest'),
                            photo: getSafeAvatar(userData)
                        });
                    } else {
                        setHostInfo({
                            name: activePrivateInvitation?.fromUserName || invitation?.fromUserName || invitation?.hostName || t('guest'),
                            photo: activePrivateInvitation?.fromUserAvatar || invitation?.fromUserAvatar
                        });
                    }
                } catch (error) {
                    console.error("Error fetching host data:", error);
                    setHostInfo({
                        name: activePrivateInvitation?.fromUserName || invitation?.fromUserName || invitation?.hostName || t('guest'),
                        photo: activePrivateInvitation?.fromUserAvatar || invitation?.fromUserAvatar
                    });
                }
            } else {
                setHostInfo({
                    name: activePrivateInvitation?.fromUserName || invitation?.fromUserName || invitation?.hostName || t('guest'),
                    photo: activePrivateInvitation?.fromUserAvatar || invitation?.fromUserAvatar
                });
            }
        };
        fetchHostData();
    }, [invitation, activePrivateInvitation]);

    if (!activePrivateInvitation || !invitation || isTransitioning) return null;

    const handleOpen = () => setIsOpen(true);

    const handleViewDetails = async () => {
        setIsTransitioning(true);
        await markAsRead(activePrivateInvitation.id);
        setActivePrivateInvitation(null);
        navigate(`/invitation/private/${invitation.id}`);
    };

    const handleClose = async () => {
        setIsTransitioning(true);
        dismissNotification(activePrivateInvitation.id);
        setActivePrivateInvitation(null);
    };

    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    // Find current index
    const currentIndex = unreadPrivateInvitations.findIndex(n => n.id === activePrivateInvitation.id) + 1;
    const totalCount = unreadPrivateInvitations.length;

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        const currentX = e.targetTouches[0].clientX;
        setTouchEnd(currentX);
        if (touchStart) {
            setDragX(currentX - touchStart);
        }
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setDragX(0);
            return;
        }
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && currentIndex < totalCount) {
            handleNext();
        } else if (isRightSwipe && currentIndex > 1) {
            handlePrev();
        } else {
            // Reset position if swipe wasn't long enough
            setDragX(0);
        }
        setTouchStart(null);
        setTouchEnd(null);
    };

    const handleNext = () => {
        if (currentIndex < totalCount) {
            setSlideDirection('next');
            setIsOpen(false);
            setTimeout(() => {
                setActivePrivateInvitation(unreadPrivateInvitations[currentIndex]);
                setDragX(0);
                setSlideDirection(null);
            }, 600);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 1) {
            setSlideDirection('prev');
            setIsOpen(false);
            setTimeout(() => {
                setActivePrivateInvitation(unreadPrivateInvitations[currentIndex - 2]);
                setDragX(0);
                setSlideDirection(null);
            }, 600);
        }
    };

    return (
        <div className="private-invitation-overlay">
            {/* Multi-invitation Badge */}
            {totalCount > 1 && (
                <div style={{
                    position: 'fixed',
                    top: '40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2000,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(10px)',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap'
                }}>
                    ✨ {t('you_have_multiple_invitations', { current: currentIndex, total: totalCount })}
                </div>
            )}

            <div
                className={`overlay-backdrop ${isOpen ? 'is-open' : ''} ${isTransitioning ? 'fade-out' : ''}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Navigation Arrows (Screen Edges) */}
                {totalCount > 1 && (
                    <>
                        <button
                            className={`nav-arrow nav-prev ${currentIndex === 1 ? 'disabled' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            disabled={currentIndex === 1}
                        >
                            <FaChevronLeft />
                        </button>
                        <button
                            className={`nav-arrow nav-next ${currentIndex === totalCount ? 'disabled' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            disabled={currentIndex === totalCount}
                        >
                            <FaChevronRight />
                        </button>
                    </>
                )}

                <div
                    key={activePrivateInvitation.id}
                    className={`envelope-wrapper ${slideDirection ? `slide-${slideDirection}` : ''}`}
                    style={{
                        transform: !slideDirection ? `translateX(${dragX}px)` : undefined,
                        transition: !touchStart && !slideDirection ? 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
                    }}
                >
                    {/* Pagination Dots (Mobile context) */}
                    {totalCount > 1 && (
                        <div className="pagination-dots">
                            {[...Array(totalCount)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`dot ${currentIndex === i + 1 ? 'active' : ''}`}
                                />
                            ))}
                        </div>
                    )}

                    <div
                        className={`envelope-container ${isOpen ? 'is-open' : ''}`}
                        onClick={!isOpen ? handleOpen : undefined}
                    >
                        {/* Envelope Back */}
                        <div className="envelope-base"></div>

                        {/* Envelope Flap */}
                        <div className="envelope-flap"></div>

                        {/* Seal */}
                        <div className="envelope-seal">
                            <FaLock />
                        </div>

                        {/* The Card (Inside) */}
                        <div className={`card-preview-wrapper theme-${(invitation.occasionType || 'social').toLowerCase()}`}>
                            <div className="card-inner-overlay" style={{
                                fontFamily: templateStyles?.layout?.fontFamily || 'inherit',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '300px'
                            }}>
                                {/* Floating Background Icons Layer */}
                                <div className="bg-floating-icons">
                                    {[...Array(12)].map((_, i) => (
                                        <span
                                            key={i}
                                            className={`floating-icon icon-${i}`}
                                            style={{
                                                left: `${(i * 27) % 100}%`,
                                                top: `${(i * 37) % 100}%`,
                                                animationDelay: `${i * 0.4}s`,
                                                fontSize: `${1 + (i % 3) * 0.5}rem`
                                            }}
                                        >
                                            {backgroundIcons[i % backgroundIcons.length]}
                                        </span>
                                    ))}
                                </div>

                                {/* Lottie Background Animation (If available) */}
                                {animationData && (
                                    <div className="lottie-bg-container">
                                        <Lottie
                                            animationData={animationData}
                                            loop={true}
                                            autoPlay={true}
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                width: '100%',
                                                height: '100%',
                                                zIndex: 0,
                                                pointerEvents: 'none'
                                            }}
                                            rendererSettings={{
                                                preserveAspectRatio: 'xMidYMid slice'
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Floating category icon */}
                                <div className="category-reveal reveal-text reveal-delay-1" style={{ position: 'relative', zIndex: 3, marginBottom: '20px' }}>
                                    <span className="giant-icon">
                                        {invitation.occasionType ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.emoji || '🍽️' : '🍽️'}
                                    </span>
                                </div>

                                <div className="host-identity-section reveal-text reveal-delay-3" style={{ zIndex: 3, textAlign: 'center', marginBottom: '35px' }}>
                                    <div className="host-avatar-wrapper">
                                        <img
                                            src={getSafeAvatar({ photoURL: hostInfo.photo, display_name: hostInfo.name })}
                                            alt={hostInfo.name}
                                            className="host-avatar-overlay"
                                        />
                                    </div>
                                    <h2 style={{
                                        fontSize: '1.9rem',
                                        color: 'white',
                                        lineHeight: '1.2',
                                        margin: '15px 0 0 0',
                                        fontWeight: '900',
                                        textShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                        maxWidth: '340px'
                                    }}>
                                        {t('you_have_private_invitation_from_redesign', {
                                            host: hostInfo.name || t('guest'),
                                            defaultValue: `You have a private invitation from ${hostInfo.name || t('guest')}`
                                        })}
                                    </h2>
                                </div>

                                <div className="overlay-actions reveal-text reveal-delay-4" style={{ position: 'relative', width: '100%', zIndex: 3, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <button className="btn-open-details" onClick={handleViewDetails}>
                                        {t('view_invitation_details')} <FaArrowRight style={{ marginLeft: '10px' }} />
                                    </button>
                                    <button className="btn-close-overlay" onClick={handleClose}>
                                        {t('later')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isOpen && (
                        <div style={{
                            position: 'absolute',
                            bottom: '-60px',
                            left: 0,
                            right: 0,
                            textAlign: 'center',
                            color: 'white',
                            animation: 'pulse 2s infinite'
                        }}>
                            <p style={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>
                                {t('open_envelope')}
                            </p>
                        </div>
                    )}
                </div>

                <style>{`
                    @keyframes pulse {
                        0% { opacity: 0.5; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.05); }
                        100% { opacity: 0.5; transform: scale(1); }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default PrivateInvitationOverlay;
