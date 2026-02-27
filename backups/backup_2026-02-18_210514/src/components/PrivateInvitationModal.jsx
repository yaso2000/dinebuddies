import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { FaTimes, FaEnvelope, FaEnvelopeOpen } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const PrivateInvitationModal = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { notifications, markAsRead } = useNotifications();
    const [showModal, setShowModal] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    // Touch handlers for swipe
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    // Get all unread private invitations
    const privateInvitations = notifications.filter(
        n => n.type === 'private_invitation' && !n.read
    );

    const currentInvitation = privateInvitations[currentIndex];

    useEffect(() => {
        if (privateInvitations.length > 0) {
            // Reset to first invitation if current index is out of bounds
            if (currentIndex >= privateInvitations.length) {
                setCurrentIndex(0);
            }
            setShowModal(true);
            // Auto-open after 1 second
            setTimeout(() => setIsOpen(true), 1000);
        } else {
            setShowModal(false);
            setCurrentIndex(0);
        }
    }, [privateInvitations.length, currentIndex]);

    const handleClose = async () => {
        if (currentInvitation) {
            await markAsRead(currentInvitation.id);
        }
        setShowModal(false);
        setCurrentIndex(0);
        setIsOpen(false);
    };

    const handleViewInvitation = async () => {
        if (currentInvitation) {
            await markAsRead(currentInvitation.id);
            navigate(`/invitation/${currentInvitation.invitationId}`);
            setShowModal(false);
            setCurrentIndex(0);
        }
    };


    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (touchStart - touchEnd > 75) {
            // Swipe left - next
            if (currentIndex < privateInvitations.length - 1) {
                setCurrentIndex(currentIndex + 1);
            }
        }

        if (touchStart - touchEnd < -75) {
            // Swipe right - previous
            if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }
        }
    };

    if (!showModal || !currentInvitation) return null;

    return (
        <>
            {/* Semi-transparent Overlay */}
            <div
                onClick={handleClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'fadeIn 0.3s ease-in-out',
                    padding: '20px'
                }}
            >
                {/* Card Container - Click inside won't close */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '420px',
                        animation: 'slideUp 0.5s ease-out'
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        style={{
                            position: 'absolute',
                            top: '-50px',
                            right: '0',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                            fontSize: '1.3rem',
                            transition: 'all 0.2s',
                            zIndex: 10
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        <FaTimes />
                    </button>

                    {/* Envelope */}
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '16px',
                        padding: '3rem 2rem 2rem 2rem',
                        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.7)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Floating Food Icons */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            pointerEvents: 'none',
                            zIndex: 0
                        }}>
                            {['🍕', '🍔', '🍣', '🍰', '🍷', '☕', '🍜', '🥗'].map((emoji, i) => (
                                <div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        fontSize: '3rem',
                                        opacity: 0.3,
                                        animation: `float${i % 3} ${4 + i}s ease-in-out infinite`,
                                        left: `${(i * 12) % 90}%`,
                                        top: `${(i * 15) % 80}%`
                                    }}
                                >
                                    {emoji}
                                </div>
                            ))}
                        </div>

                        {/* Envelope Icon */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '1.5rem',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            <div style={{
                                display: 'inline-block',
                                background: 'rgba(255, 255, 255, 0.25)',
                                borderRadius: '50%',
                                padding: '1.5rem',
                                animation: isOpen ? 'bounce 0.6s ease-out' : 'pulse 2s infinite',
                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
                            }}>
                                {isOpen ? (
                                    <FaEnvelopeOpen style={{
                                        fontSize: '4rem',
                                        color: 'white',
                                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                                    }} />
                                ) : (
                                    <FaEnvelope style={{
                                        fontSize: '4rem',
                                        color: 'white',
                                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                                    }} />
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <h2 style={{
                            color: 'white',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            marginBottom: '0.5rem',
                            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            💌 {t('private_invitation') || 'Private Invitation'}
                        </h2>

                        {/* Counter - Show if multiple invitations */}
                        {privateInvitations.length > 1 && (
                            <div style={{
                                textAlign: 'center',
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                marginBottom: '0.5rem',
                                position: 'relative',
                                zIndex: 1
                            }}>
                                {currentIndex + 1} {t('of', { defaultValue: 'of' })} {privateInvitations.length}
                            </div>
                        )}

                        <p style={{
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            marginBottom: '2rem',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {privateInvitations.length > 1
                                ? t('you_received_multiple_invitations', { defaultValue: 'You received special invitations!' })
                                : t('you_received_special_invitation') || 'You received a special invitation!'}
                        </p>

                        {/* Card Content */}
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            marginBottom: '1.5rem',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {/* Sender Info */}
                            {currentInvitation.senderAvatar && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '1rem',
                                    paddingBottom: '1rem',
                                    borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                                }}>
                                    <img
                                        src={currentInvitation.senderAvatar}
                                        alt={currentInvitation.senderName}
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '50%',
                                            border: '3px solid #f093fb',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>
                                            {currentInvitation.senderName}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                            {t('invited_you') || 'invited you'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Invitation Details */}
                            <div style={{ color: '#333' }}>
                                {currentInvitation.invitationTitle && (
                                    <div style={{
                                        marginBottom: '0.75rem',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        color: '#f5576c'
                                    }}>
                                        📍 {currentInvitation.invitationTitle}
                                    </div>
                                )}
                                {currentInvitation.invitationDate && (
                                    <div style={{
                                        fontSize: '0.95rem',
                                        color: '#555',
                                        marginBottom: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span>📅</span>
                                        <span>{currentInvitation.invitationDate}</span>
                                        {currentInvitation.invitationTime && (
                                            <>
                                                <span style={{ margin: '0 4px' }}>•</span>
                                                <span>⏰ {currentInvitation.invitationTime}</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {currentInvitation.invitationLocation && (
                                    <div style={{
                                        fontSize: '0.9rem',
                                        color: '#666',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span>📌</span>
                                        <span>{currentInvitation.invitationLocation}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Navigation Buttons - Show if multiple invitations */}
                        {privateInvitations.length > 1 && (
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                marginBottom: '1rem',
                                position: 'relative',
                                zIndex: 1
                            }}>
                                <button
                                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentIndex === 0}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '10px',
                                        border: '2px solid white',
                                        background: currentIndex === 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                        cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                                        opacity: currentIndex === 0 ? 0.5 : 1,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    ← {t('previous', { defaultValue: 'Previous' })}
                                </button>
                                <button
                                    onClick={() => setCurrentIndex(prev => Math.min(privateInvitations.length - 1, prev + 1))}
                                    disabled={currentIndex === privateInvitations.length - 1}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '10px',
                                        border: '2px solid white',
                                        background: currentIndex === privateInvitations.length - 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                        cursor: currentIndex === privateInvitations.length - 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentIndex === privateInvitations.length - 1 ? 0.5 : 1,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {t('next', { defaultValue: 'Next' })} →
                                </button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            <button
                                onClick={handleClose}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '2px solid white',
                                    background: 'transparent',
                                    color: 'white',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {t('later') || 'Later'}
                            </button>
                            <button
                                onClick={handleViewInvitation}
                                style={{
                                    flex: 2,
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'white',
                                    color: '#f5576c',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
                                }}
                            >
                                {t('view_invitation') || 'View Invitation'} 🎉
                            </button>
                        </div>
                    </div>

                    {/* Dots Indicator - Show if multiple invitations */}
                    {privateInvitations.length > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '16px',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {privateInvitations.map((_, index) => (
                                <div
                                    key={index}
                                    onClick={() => setCurrentIndex(index)}
                                    style={{
                                        width: index === currentIndex ? '24px' : '8px',
                                        height: '8px',
                                        borderRadius: '4px',
                                        background: index === currentIndex
                                            ? 'white'
                                            : 'rgba(255, 255, 255, 0.4)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: index === currentIndex
                                            ? '0 2px 8px rgba(255, 255, 255, 0.3)'
                                            : 'none'
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(50px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    25% { transform: translateY(-15px); }
                    50% { transform: translateY(0); }
                    75% { transform: translateY(-7px); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes float0 {
                    0%, 100% { 
                        transform: translateY(0) rotate(0deg);
                        opacity: 0.3;
                    }
                    50% { 
                        transform: translateY(-20px) rotate(10deg);
                        opacity: 0.5;
                    }
                }
                @keyframes float1 {
                    0%, 100% { 
                        transform: translateY(0) rotate(0deg);
                        opacity: 0.25;
                    }
                    50% { 
                        transform: translateY(-30px) rotate(-10deg);
                        opacity: 0.45;
                    }
                }
                @keyframes float2 {
                    0%, 100% { 
                        transform: translateY(0) rotate(0deg);
                        opacity: 0.28;
                    }
                    50% { 
                        transform: translateY(-25px) rotate(15deg);
                        opacity: 0.48;
                    }
                }
            `}</style>
        </>
    );
};

export default PrivateInvitationModal;
