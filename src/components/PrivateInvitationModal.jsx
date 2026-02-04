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
    const [currentInvitation, setCurrentInvitation] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Check for unread private invitation notifications
        const privateInvitations = notifications.filter(
            n => n.type === 'private_invitation' && !n.read
        );

        if (privateInvitations.length > 0) {
            // Show the first unread private invitation
            setCurrentInvitation(privateInvitations[0]);
            setShowModal(true);
            // Auto-open after 1 second
            setTimeout(() => setIsOpen(true), 1000);
        }
    }, [notifications]);

    const handleClose = async () => {
        if (currentInvitation) {
            await markAsRead(currentInvitation.id);
        }
        setShowModal(false);
        setCurrentInvitation(null);
        setIsOpen(false);
    };

    const handleViewInvitation = async () => {
        if (currentInvitation) {
            await markAsRead(currentInvitation.id);
            navigate(`/invitation/${currentInvitation.invitationId}`);
            setShowModal(false);
            setCurrentInvitation(null);
        }
    };

    if (!showModal || !currentInvitation) return null;

    return (
        <>
            {/* Full Screen Overlay */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(10px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.3s ease-in-out'
            }}>
                {/* Envelope Card */}
                <div style={{
                    position: 'relative',
                    width: '90%',
                    maxWidth: '500px',
                    animation: 'slideUp 0.5s ease-out'
                }}>
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
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        borderRadius: '16px',
                        padding: '3rem 2rem 2rem 2rem',
                        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.7)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Decorative Pattern */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '100%',
                            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                            opacity: 0.3,
                            pointerEvents: 'none'
                        }}></div>

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

                        <p style={{
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            marginBottom: '2rem',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {t('you_received_special_invitation') || 'You received a special invitation!'}
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
            `}</style>
        </>
    );
};

export default PrivateInvitationModal;
