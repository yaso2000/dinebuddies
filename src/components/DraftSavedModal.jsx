import React from 'react';
import { FaCrown, FaTimes, FaPalette, FaLink, FaMagic } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DraftSavedModal = ({ isOpen, onClose, featureName = "feature" }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    if (!isOpen) return null;

    const getIcon = () => {
        if (featureName.includes('Brand') || featureName.includes('لوحة') || featureName.includes('palette')) return <FaPalette size={32} color="#fbbf24" />;
        if (featureName.includes('Link') || featureName.includes('رابط') || featureName.includes('link')) return <FaLink size={32} color="#fbbf24" />;
        return <FaMagic size={32} color="#fbbf24" />;
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(5, 5, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <style>{`
                @keyframes slideUpFade {
                    from { transform: translateY(30px) scale(0.95); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
                .draft-modal-content {
                    animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>

            <div className="draft-modal-content" style={{
                background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '32px',
                width: '90%',
                maxWidth: '460px',
                padding: '40px 30px',
                position: 'relative',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(139, 92, 246, 0.15)',
                textAlign: 'center',
                overflow: 'hidden'
            }}>
                {/* Decorative Glow */}
                <div style={{
                    position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
                    width: 200, height: 100, background: 'rgba(251, 191, 36, 0.3)',
                    filter: 'blur(60px)', borderRadius: '50%', zIndex: 0
                }} />

                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: 20, right: 20,
                        background: 'rgba(255,255,255,0.05)', border: 'none',
                        color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                        width: 36, height: 36, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10, transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                >
                    <FaTimes size={18} />
                </button>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                    <div style={{
                        width: 80, height: 80, borderRadius: '24px',
                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.05))',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 24, boxShadow: 'inset 0 0 20px rgba(251, 191, 36, 0.1)'
                    }}>
                        {getIcon()}
                    </div>

                    <h2 style={{
                        fontSize: '1.6rem', fontWeight: 800, color: 'white',
                        marginBottom: 12, lineHeight: 1.3, letterSpacing: '-0.5px'
                    }}>
                        {t('draft_modal_title', 'Your profile is starting to look amazing! ✨')}
                    </h2>

                    <p style={{
                        fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)',
                        lineHeight: 1.6, marginBottom: 32, padding: '0 10px'
                    }}>
                        {t('draft_modal_description', "Don't worry, we've safely saved everything you did as a draft so your work isn't lost. Take your time, and once you join as a partner, this new look will be published instantly for your customers!")}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                        <button
                            onClick={() => {
                                onClose();
                                navigate('/settings/subscription');
                            }}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '16px',
                                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                border: 'none', color: '#1e1b4b',
                                fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)', transition: 'transform 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <FaCrown /> {t('explore_packages', 'Explore Packages Now')}
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '16px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: '1rem',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                        >
                            {t('continue_customizing', 'Continue Customizing')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DraftSavedModal;
