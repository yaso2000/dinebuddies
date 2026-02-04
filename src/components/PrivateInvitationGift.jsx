import React, { useState, useEffect } from 'react';
import { FaGift, FaTimes, FaEnvelopeOpenText } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const PrivateInvitationGift = ({ invitations, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [animate, setAnimate] = useState(false);
    const [isHidden, setIsHidden] = useState(false);

    // Clear hidden invitations on component mount (fresh session)
    useEffect(() => {
        // Check if this is a fresh session (page reload or new login)
        const sessionKey = 'privateInvitationsSessionActive';
        const isNewSession = !sessionStorage.getItem(sessionKey);

        if (isNewSession) {
            // Clear the hidden invitations from previous session
            localStorage.removeItem('hiddenPrivateInvitations');
            // Mark this session as active
            sessionStorage.setItem(sessionKey, 'true');
        }
    }, []);

    useEffect(() => {
        // Trigger entrance animation
        setAnimate(true);
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleHideGift = () => {
        // Hide the gift and store in localStorage
        setIsHidden(true);
        // Store hidden state with timestamp
        const hiddenGifts = JSON.parse(localStorage.getItem('hiddenPrivateInvitations') || '{}');
        invitations.forEach(inv => {
            hiddenGifts[inv.id] = Date.now();
        });
        localStorage.setItem('hiddenPrivateInvitations', JSON.stringify(hiddenGifts));
    };

    // Filter out invitations that were hidden in this session
    const visibleInvitations = invitations.filter(inv => {
        const hiddenGifts = JSON.parse(localStorage.getItem('hiddenPrivateInvitations') || '{}');
        return !hiddenGifts[inv.id];
    });

    if (visibleInvitations.length === 0 || isHidden) return null;

    return (
        <>
            {/* The Floating Gift Box */}
            {!isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2000,
                        animation: 'float 3s ease-in-out infinite'
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleHideGift();
                        }}
                        style={{
                            position: 'absolute',
                            top: '-15px',
                            left: '-15px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            border: '2px solid white',
                            borderRadius: '50%',
                            width: '30px',
                            height: '30px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                            fontSize: '1rem',
                            zIndex: 10,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#EF4444';
                            e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <FaTimes />
                    </button>

                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={handleOpen}>
                        {/* Glow Effect */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '80px',
                            height: '80px',
                            background: 'radial-gradient(circle, rgba(251,191,36,0.8) 0%, rgba(251,191,36,0) 70%)',
                            borderRadius: '50%',
                            animation: 'pulse-glow 2s infinite'
                        }}></div>

                        {/* Gift Icon */}
                        <div style={{
                            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.5)',
                            border: '3px solid white',
                            position: 'relative',
                            zIndex: 2
                        }}>
                            <FaGift style={{ fontSize: '1.8rem', color: 'white' }} />
                            <div style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                background: '#EF4444',
                                color: 'white',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                border: '2px solid white'
                            }}>
                                {visibleInvitations.length}
                            </div>
                        </div>

                        {/* Text Label */}
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '15px',
                            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '12px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                            border: '2px solid white'
                        }}>
                            {t('private_invite_received') || 'Special Invite!'}
                        </div>
                    </div>
                </div>
            )}

            {/* The Modal / Opened State */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2001,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                        width: '100%',
                        maxWidth: '400px',
                        borderRadius: '24px',
                        padding: '2rem',
                        position: 'relative',
                        border: '3px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        overflow: 'hidden'
                    }}>
                        {/* Decorative Hearts & Flowers */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            pointerEvents: 'none',
                            overflow: 'hidden'
                        }}>
                            {/* Top Left Flowers */}
                            <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '2rem', opacity: 0.3, animation: 'float 3s ease-in-out infinite' }}>
                                🌸
                            </div>
                            <div style={{ position: 'absolute', top: '30px', left: '50px', fontSize: '1.5rem', opacity: 0.25, animation: 'float 4s ease-in-out infinite 0.5s' }}>
                                🌺
                            </div>

                            {/* Top Right Hearts */}
                            <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.8rem', opacity: 0.3, animation: 'pulse 2s ease-in-out infinite' }}>
                                💕
                            </div>
                            <div style={{ position: 'absolute', top: '50px', right: '50px', fontSize: '1.3rem', opacity: 0.25, animation: 'pulse 2.5s ease-in-out infinite 0.3s' }}>
                                💖
                            </div>

                            {/* Bottom Left Hearts */}
                            <div style={{ position: 'absolute', bottom: '20px', left: '20px', fontSize: '1.5rem', opacity: 0.3, animation: 'pulse 3s ease-in-out infinite 0.7s' }}>
                                ❤️
                            </div>

                            {/* Bottom Right Flowers */}
                            <div style={{ position: 'absolute', bottom: '15px', right: '25px', fontSize: '2rem', opacity: 0.3, animation: 'float 3.5s ease-in-out infinite 1s' }}>
                                🌼
                            </div>
                            <div style={{ position: 'absolute', bottom: '50px', right: '60px', fontSize: '1.4rem', opacity: 0.25, animation: 'float 4s ease-in-out infinite 0.2s' }}>
                                🌷
                            </div>

                            {/* Center Sparkles */}
                            <div style={{ position: 'absolute', top: '40%', left: '15%', fontSize: '1rem', opacity: 0.4, animation: 'twinkle 2s ease-in-out infinite' }}>
                                ✨
                            </div>
                            <div style={{ position: 'absolute', top: '60%', right: '20%', fontSize: '1rem', opacity: 0.4, animation: 'twinkle 2s ease-in-out infinite 0.5s' }}>
                                ✨
                            </div>
                        </div>
                        {/* Close Button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255, 255, 255, 0.7)',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}
                        >
                            <FaTimes />
                        </button>

                        {/* Content */}
                        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                            <div style={{
                                margin: '0 auto 1.5rem',
                                width: '80px',
                                height: '80px',
                                background: 'rgba(251, 191, 36, 0.15)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <FaEnvelopeOpenText style={{ fontSize: '2.5rem', color: '#fbbf24' }} />
                            </div>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>
                                {t('you_are_invited') || 'You are Invited!'}
                            </h2>
                            <p style={{ color: 'rgba(255, 255, 255, 0.85)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                                {t('private_invite_desc') || 'You have received a special private invitation.'}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {visibleInvitations.map(inv => (
                                    <div
                                        key={inv.id}
                                        onClick={() => {
                                            navigate(`/invitation/${inv.id}`);
                                            onClose(); // Optional: close modal when navigating
                                        }}
                                        style={{
                                            background: 'white',
                                            padding: '15px',
                                            borderRadius: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '15px',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            transition: 'transform 0.2s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <img
                                            src={inv.author?.avatar || 'https://via.placeholder.com/40'}
                                            alt={inv.author?.name}
                                            style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbbf24' }}
                                        />
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '2px' }}>{inv.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#F59E0B' }}>
                                                {t('from') || 'From'} {inv.author?.name}
                                            </div>
                                        </div>
                                        <div style={{
                                            background: '#fbbf24',
                                            color: '#000',
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {t('view') || 'View'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>
                {`
                    @keyframes float {
                        0% { transform: translateY(0px); }
                        50% { transform: translateY(-10px); }
                        100% { transform: translateY(0px); }
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); opacity: 0.3; }
                        50% { transform: scale(1.2); opacity: 0.5; }
                    }
                    @keyframes pulse-glow {
                        0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.7; }
                        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.3; }
                        100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.7; }
                    }
                    @keyframes popIn {
                        0% { transform: scale(0.8); opacity: 0; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes twinkle {
                        0%, 100% { opacity: 0.2; transform: scale(1); }
                        50% { opacity: 0.8; transform: scale(1.3); }
                    }
                `}
            </style>
        </>
    );
};

export default PrivateInvitationGift;
