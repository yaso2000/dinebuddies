import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCrown, FaTimes, FaCheckCircle, FaPalette, FaGlobe, FaStar } from 'react-icons/fa';

const PremiumPaywallModal = ({ isOpen, onClose, featureName = "Premium Feature" }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const PREMIUM_FEATURES = [
        { icon: <FaPalette />, text: "Full Brand Kit fully applied to your profile" },
        { icon: <FaGlobe />, text: "Custom Delivery Links (UberEats, DoorDash, etc.)" },
        { icon: <FaStar />, text: "Reply to customer reviews & build loyalty" },
        { icon: <FaCheckCircle />, text: "Verified Badge (✅) and Trust Signals" }
    ];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            {/* Modal Body */}
            <div style={{
                background: '#111827', width: '100%', maxWidth: '440px',
                borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* Header Graphic */}
                <div style={{
                    background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                    padding: '30px 20px', textAlign: 'center', position: 'relative'
                }}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '15px', right: '15px',
                        background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff',
                        width: '32px', height: '32px', borderRadius: '50%',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}>
                        <FaTimes />
                    </button>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 15px', color: '#f59e0b', fontSize: '2rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <FaCrown />
                    </div>
                    <h2 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '800', margin: '0 0 5px' }}>
                        Unlock {featureName}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
                        Take your business profile to the next level.
                    </p>
                </div>

                {/* Features List */}
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                        {PREMIUM_FEATURES.map((feat, i) => (
                            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    {feat.icon}
                                </div>
                                <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 500 }}>{feat.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* CTAs */}
                    <button
                        onClick={() => {
                            onClose();
                            navigate('/business-pro/subscription');
                        }}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#fff', fontSize: '1.05rem', fontWeight: '800', border: 'none',
                            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)', transition: 'transform 0.1s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <FaCrown /> Upgrade to Pro
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%', padding: '12px', marginTop: '12px', borderRadius: '12px',
                            background: 'transparent', color: 'var(--text-muted)',
                            fontSize: '0.9rem', fontWeight: '600', border: 'none', cursor: 'pointer'
                        }}
                    >
                        Maybe Later
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default PremiumPaywallModal;
