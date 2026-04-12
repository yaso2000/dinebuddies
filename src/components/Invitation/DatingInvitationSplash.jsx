import React, { useState, useRef, useEffect } from 'react';
import { FaArrowRight, FaHeart, FaPlay } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar } from '../../utils/avatarUtils';

/**
 * DatingInvitationSplash
 * 
 * Shown when the current user has a pending dating invitation.
 * Phase flow:
 *   idle    → shows paused video poster + tap-to-play hint
 *   playing → video plays fullscreen (no controls)
 *   done    → video frozen at last frame + floating sender overlay
 */
const DatingInvitationSplash = ({ invitation, hostInfo, onView, onClose }) => {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('idle'); // 'idle' | 'playing' | 'done'
    const videoRef = useRef(null);

    // Colour accent for dating theme
    const accent = '#ec4899';

    useEffect(() => {
        // Preload video
        if (videoRef.current) {
            videoRef.current.load();
        }
    }, []);

    const handleTap = () => {
        if (phase !== 'idle') return;
        setPhase('playing');
        const v = videoRef.current;
        if (v) {
            v.play().catch(() => {});
        }
    };

    const handleVideoEnded = () => {
        setPhase('done');
    };

    const restaurantName = invitation?.restaurantName || invitation?.location || '';

    return (
        <div
            onClick={phase === 'idle' ? handleTap : undefined}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: phase === 'idle' ? 'pointer' : 'default',
            }}
        >
            {/* ── Video ─────────────────────────────────── */}
            <video
                ref={videoRef}
                src="/videos/db-date.mp4"
                playsInline
                preload="auto"
                onEnded={handleVideoEnded}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
            />

            {/* ── Idle: dark overlay + tap hint ─────────── */}
            {phase === 'idle' && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.2rem',
                }}>
                    {/* Play button ring */}
                    <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        border: `3px solid ${accent}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'datingSplashPulse 1.8s ease-in-out infinite',
                        boxShadow: `0 0 30px ${accent}66`,
                    }}>
                        <FaPlay style={{ color: accent, fontSize: '1.8rem', marginLeft: 6 }} />
                    </div>
                    <p style={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    }}>
                        {t('dating_splash_tap_open', 'Tap to open your message ❤️')}
                    </p>
                </div>
            )}

            {/* ── Done: sender overlay ───────────────────── */}
            {phase === 'done' && (
                <>
                    {/* gradient scrim */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '65%',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 50%, transparent)',
                        pointerEvents: 'none',
                    }} />

                    {/* Floating card */}
                    <div style={{
                        position: 'absolute',
                        bottom: 60,
                        left: 20,
                        right: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        animation: 'datingSplashSlideUp 0.5s cubic-bezier(0.22.1,0.36,1)',
                    }}>
                        {/* Heart icon */}
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${accent}, #be185d)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 4px 20px ${accent}88`,
                        }}>
                            <FaHeart style={{ color: '#fff', fontSize: '1.3rem' }} />
                        </div>

                        {/* Avatar */}
                        <img
                            src={getSafeAvatar({ photoURL: hostInfo?.photo, display_name: hostInfo?.name })}
                            alt={hostInfo?.name}
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: '50%',
                                border: `3px solid ${accent}`,
                                objectFit: 'cover',
                                boxShadow: `0 0 20px ${accent}66`,
                            }}
                        />

                        {/* Text */}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                color: '#fff',
                                fontSize: '1.3rem',
                                fontWeight: 800,
                                marginBottom: '0.4rem',
                                textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                            }}>
                                {hostInfo?.name || 'Someone'}
                            </p>
                            <p style={{
                                color: 'rgba(255,255,255,0.85)',
                                fontSize: '0.95rem',
                                fontWeight: 500,
                                lineHeight: 1.5,
                            }}>
                                {t('dating_splash_sent_invite', 'sent you a date invitation')}
                                {restaurantName ? (
                                    <> {t('at', 'at')} <strong style={{ color: accent }}>{restaurantName}</strong></>
                                ) : null}
                            </p>
                        </div>

                        {/* Buttons */}
                        <button
                            onClick={onView}
                            style={{
                                width: '100%',
                                padding: '0.9rem',
                                background: `linear-gradient(135deg, ${accent}, #be185d)`,
                                border: 'none',
                                borderRadius: '14px',
                                color: '#fff',
                                fontSize: '1rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                boxShadow: `0 4px 20px ${accent}55`,
                            }}
                        >
                            {t('view_invitation', 'View Invitation')} <FaArrowRight />
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                padding: '0.5rem',
                            }}
                        >
                            {t('later', 'Later')}
                        </button>
                    </div>
                </>
            )}

            {/* Keyframes */}
            <style>{`
                @keyframes datingSplashPulse {
                    0%, 100% { transform: scale(1);    opacity: 1; }
                    50%       { transform: scale(1.12); opacity: 0.8; }
                }
                @keyframes datingSplashSlideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default DatingInvitationSplash;
