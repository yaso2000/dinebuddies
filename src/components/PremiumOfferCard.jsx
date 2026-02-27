import React from 'react';
import { FaEdit, FaPause, FaPlay, FaTrash } from 'react-icons/fa';
import AnimatedOfferIcon from './AnimatedOfferIcons';

const themeStyles = {
    'Midnight Lux': {
        bg: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
        titleText: '#D4AF37', // Gold
        descText: '#e5e7eb',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        overlay: 'rgba(0, 0, 0, 0.5)',
        shadow: 'rgba(212, 175, 55, 0.15)'
    },
    'Luxurious Gold': {
        bg: 'linear-gradient(135deg, #1f1a0e 0%, #302404 100%)', // Very dark rich gold/brown background
        titleText: '#ffd700', // Bright pure gold
        descText: '#f3e5ab',
        border: '1px solid #ffd700',
        overlay: 'rgba(31, 26, 14, 0.7)',
        shadow: 'rgba(255, 215, 0, 0.4)'
    },
    'Pristine Silver': {
        bg: 'linear-gradient(135deg, #101217 0%, #20242b 100%)', // Deep charcoal/silver back
        titleText: '#e5e7eb', // Bright silver
        descText: '#9ca3af',
        border: '1px solid #d1d5db',
        overlay: 'rgba(16, 18, 23, 0.7)',
        shadow: 'rgba(209, 213, 219, 0.3)'
    },
    'Rich Bronze': {
        bg: 'linear-gradient(135deg, #1a1006 0%, #2b1705 100%)', // Very dark copper
        titleText: '#cd7f32', // Classic Bronze
        descText: '#d8b08b',
        border: '1px solid #cd7f32',
        overlay: 'rgba(26, 16, 6, 0.7)',
        shadow: 'rgba(205, 127, 50, 0.4)'
    },
    'Sapphire Blue': {
        bg: 'linear-gradient(135deg, #001f3f 0%, #003366 100%)',
        titleText: '#E0E0E0', // Silver
        descText: '#d1d5db',
        border: '1px solid rgba(224, 224, 224, 0.3)',
        overlay: 'rgba(0, 31, 63, 0.6)',
        shadow: 'rgba(0, 51, 102, 0.3)'
    },
    'Amethyst Purple': {
        bg: 'linear-gradient(135deg, #2b003a 0%, #4a0066 100%)',
        titleText: '#D4AF37',
        descText: '#e5e7eb',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        overlay: 'rgba(43, 0, 58, 0.6)',
        shadow: 'rgba(74, 0, 102, 0.3)'
    },
    'Neon Spring': {
        bg: 'linear-gradient(135deg, #00FF7F 0%, #32CD32 100%)', // Vibrant Spring Green
        titleText: '#002200',
        descText: '#004400',
        border: '1px solid #00FA9A',
        overlay: 'rgba(0, 255, 127, 0.2)',
        shadow: 'rgba(50, 205, 50, 0.5)'
    },
    'Crimson Blaze': {
        bg: 'linear-gradient(135deg, #FF0000 0%, #DC143C 100%)', // Vibrant Red
        titleText: '#FFFFFF',
        descText: '#FFE4E1',
        border: '1px solid #FF4500',
        overlay: 'rgba(255, 0, 0, 0.2)',
        shadow: 'rgba(220, 20, 60, 0.5)'
    },
    'Sunset Orange': {
        bg: 'linear-gradient(135deg, #FF8C00 0%, #FF4500 100%)', // Vibrant Orange
        titleText: '#FFFFFF',
        descText: '#FFF5EE',
        border: '1px solid #FFA500',
        overlay: 'rgba(255, 140, 0, 0.2)',
        shadow: 'rgba(255, 69, 0, 0.5)'
    },
    'Solar Yellow': {
        bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', // Vibrant Yellow
        titleText: '#000000',
        descText: '#333333',
        border: '1px solid #FFFF00',
        overlay: 'rgba(255, 215, 0, 0.2)',
        shadow: 'rgba(255, 215, 0, 0.5)'
    },
    'Sky Blue': {
        bg: 'linear-gradient(135deg, #00BFFF 0%, #1E90FF 100%)', // Vibrant Sky Blue
        titleText: '#FFFFFF',
        descText: '#F0F8FF',
        border: '1px solid #87CEEB',
        overlay: 'rgba(0, 191, 255, 0.2)',
        shadow: 'rgba(30, 144, 255, 0.5)'
    }
};

const PremiumOfferCard = ({
    offer,
    onEdit,
    onFreeze,
    onRepublish,
    onDelete,
    isOwnerView = false,
    compactHeight = false
}) => {
    const themeName = offer.theme || 'Midnight Lux';
    const currentTheme = themeStyles[themeName] || themeStyles['Midnight Lux'];

    // Shine mappings with professional multi-ray metallic effects
    const shineColorMap = {
        'Gold': 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.1) 20%, rgba(255, 215, 0, 0.8) 45%, rgba(255, 255, 255, 0.9) 50%, rgba(255, 215, 0, 0.8) 55%, rgba(255, 215, 0, 0.1) 80%, transparent 100%)',
        'Silver': 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.8) 45%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.8) 55%, rgba(255, 255, 255, 0.1) 80%, transparent 100%)',
        'Bronze': 'linear-gradient(90deg, transparent 0%, rgba(205, 127, 50, 0.1) 20%, rgba(205, 127, 50, 0.8) 45%, rgba(255, 255, 255, 0.9) 50%, rgba(205, 127, 50, 0.8) 55%, rgba(205, 127, 50, 0.1) 80%, transparent 100%)'
    };
    const activeShine = offer.shine && shineColorMap[offer.shine];

    // Scale settings based on compact mode (we no longer use absolute height, relying on aspect-ratio instead)
    // Increased clamp ranges for more dynamic fluid sizing
    const titleSize = compactHeight ? 'clamp(0.9rem, 3vw, 1.4rem)' : 'clamp(1.2rem, 4.5vw, 2rem)';
    const descSize = compactHeight ? 'clamp(0.75rem, 2.5vw, 1rem)' : 'clamp(0.9rem, 3vw, 1.25rem)';
    const paddingVal = compactHeight ? '3%' : '5%';
    const logoSize = compactHeight ? 'clamp(40px, 10vw, 55px)' : 'clamp(55px, 15vw, 85px)';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            gap: '12px'
        }}>
            {/* Inject Keyframes just once for the shine effect */}
            <style>
                {`
                    @keyframes premiumShineSweep {
                        0% { transform: translateX(-400%) skewX(-30deg); opacity: 0; }
                        5% { opacity: 1; }
                        45% { opacity: 1; }
                        50% { transform: translateX(400%) skewX(-30deg); opacity: 0; }
                        100% { transform: translateX(400%) skewX(-30deg); opacity: 0; }
                    }
                    @keyframes cardFloat {
                        0%, 100% { transform: translateY(0) translateZ(0); }
                        50% { transform: translateY(-5px) translateZ(10px); }
                    }
                    @keyframes sparkle {
                        0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; filter: drop-shadow(0 0 5px gold); }
                        50% { transform: scale(1.2) rotate(15deg); opacity: 0.8; filter: drop-shadow(0 0 15px gold); }
                    }
                    @keyframes fireWobble {
                        0%, 100% { transform: scale(1) skewX(0deg); filter: drop-shadow(0 0 5px orange); }
                        25% { transform: scale(1.1, 0.9) skewX(-5deg); }
                        75% { transform: scale(0.9, 1.1) skewX(5deg); filter: drop-shadow(0 0 15px red); }
                    }
                    @keyframes bounceIcon {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-8px); }
                    }
                    @keyframes pulseIcon {
                        0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(255,255,255,0.5)); }
                        50% { transform: scale(1.15); filter: drop-shadow(0 0 10px rgba(255,255,255,0.8)); }
                    }
                    @keyframes crownFloat {
                        0%, 100% { transform: translateY(0) rotate(-2deg); }
                        50% { transform: translateY(-6px) rotate(2deg); }
                    }
                `}
            </style>
            {/* The 3D Glass Premium Card */}
            <div style={{
                display: 'flex',
                width: '100%',
                aspectRatio: '3.75 / 1',
                borderRadius: compactHeight ? '12px' : '20px',
                overflow: 'hidden',
                background: currentTheme.bg,
                border: currentTheme.border,
                borderTop: '1.5px solid rgba(255, 255, 255, 0.5)', // Sharp specular edge
                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: `
                    0 20px 40px -10px rgba(0,0,0,0.9), 
                    0 0 30px -5px ${currentTheme.shadow}, 
                    inset 0 1px 1px rgba(255,255,255,0.4), 
                    inset 0 -2px 10px rgba(0,0,0,0.6),
                    inset 2px 0 5px rgba(255,255,255,0.1)
                `,
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                position: 'relative',
                backdropFilter: 'blur(30px) saturate(150%)', // Ultra Glass
                WebkitBackdropFilter: 'blur(30px) saturate(150%)',
                transform: 'translateZ(0)',
                animation: compactHeight ? 'none' : 'cardFloat 6s infinite ease-in-out'
            }}>

                {/* Glossy Overlay for 3D Shiny effect */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: 'linear-gradient(to bottom right, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0) 50%)',
                    transform: 'rotate(30deg)',
                    pointerEvents: 'none',
                    zIndex: 2
                }}></div>

                {/* Animated Sweeping Shine Effect - Multi-Beam */}
                {activeShine && (
                    <div style={{
                        position: 'absolute',
                        top: '-20%',
                        left: 0,
                        width: '45%',
                        height: '140%',
                        background: activeShine,
                        zIndex: 4,
                        pointerEvents: 'none',
                        mixBlendMode: 'overlay',
                        animation: 'premiumShineSweep 4s infinite ease-in-out'
                    }}></div>
                )}

                {/* Left Section (25%): High-res Image */}
                <div style={{
                    flex: '0 0 25%',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <img
                        src={offer.imageUrl || 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&q=80&w=400'}
                        alt={offer.title}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                    {/* Subtle Glassmorphism overlay on image */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to right, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)',
                        borderRight: currentTheme.border,
                        zIndex: 1
                    }}></div>
                </div>

                {/* Middle Section (50%): Content Hub */}
                <div style={{
                    flex: '0 0 50%',
                    minWidth: 0,
                    padding: paddingVal,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    borderRight: currentTheme.border,
                    background: `linear-gradient(to right, ${currentTheme.bg}, transparent)`
                }}>
                    <h3 style={{
                        fontFamily: offer.headerFontFamily || offer.fontFamily || "'Inter', sans-serif",
                        fontSize: `calc(${titleSize} * ${offer.titleFontSize || 1.0})`,
                        fontWeight: offer.isBold ? '900' : (offer.headerFontWeight || '700'),
                        fontStyle: offer.isItalic ? 'italic' : 'normal',
                        color: currentTheme.titleText,
                        margin: '0 0 4px 0',
                        lineHeight: '1.2',
                        display: '-webkit-box',
                        WebkitLineClamp: compactHeight ? 1 : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        transition: 'font-size 0.2s ease'
                    }}>
                        {offer.title || 'Special Offer Title'}
                    </h3>
                    <p style={{
                        fontFamily: offer.bodyFontFamily || offer.fontFamily || "'Inter', sans-serif",
                        fontSize: `calc(${descSize} * ${offer.descriptionFontSize || 1.0})`,
                        fontWeight: offer.isBold ? '600' : (offer.bodyFontWeight || 'normal'),
                        fontStyle: offer.isItalic ? 'italic' : 'normal',
                        color: currentTheme.descText,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: '1.4',
                        transition: 'font-size 0.2s ease'
                    }}>
                        {offer.description || 'Provide a short description of your offer here...'}
                    </p>

                    {offer.status === 'inactive' && (
                        <span style={{
                            marginTop: '6px',
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            borderRadius: '12px',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            width: 'max-content'
                        }}>
                            FROZEN (Inactive)
                        </span>
                    )}
                </div>

                {/* Right Section (25%): Identity Hub */}
                <div style={{
                    flex: '0 0 25%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: currentTheme.overlay,
                    padding: compactHeight ? '0.5rem' : '1.2rem',
                    position: 'relative',
                    zIndex: 3,
                    borderLeft: `1px solid rgba(255,255,255,0.1)`
                }}>
                    {offer.identityMode === 'icon' ? (
                        <div style={{
                            width: logoSize,
                            height: logoSize,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.2))'
                        }}>
                            <AnimatedOfferIcon type={offer.selectedIcon} />
                        </div>
                    ) : (
                        offer.logoUrl ? (
                            <img
                                src={offer.logoUrl}
                                alt="Partner Logo"
                                style={{
                                    width: logoSize,
                                    height: logoSize,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: `2px solid ${currentTheme.titleText}`,
                                    boxShadow: `0 0 15px ${currentTheme.shadow}`
                                }}
                            />
                        ) : (
                            <div style={{
                                width: logoSize,
                                height: logoSize,
                                borderRadius: '50%',
                                background: `radial-gradient(circle, ${currentTheme.titleText} 0%, transparent 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: currentTheme.bg,
                                fontSize: logoIconSize,
                                fontWeight: 'bold',
                                border: `2px solid ${currentTheme.titleText}`,
                                animation: 'pulseIcon 2s infinite'
                            }}>
                                %
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Dashboard Actions (Only shown in Partner Dashboard view) */}
            {isOwnerView && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '8px 4px'
                }}>
                    <button
                        onClick={() => onEdit(offer)}
                        className="premium-action-btn"
                        style={{ ...btnBaseStyle, background: 'var(--bg-body)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    >
                        <FaEdit /> Edit
                    </button>

                    {offer.status === 'active' ? (
                        <button
                            onClick={() => onFreeze(offer)}
                            className="premium-action-btn"
                            style={{ ...btnBaseStyle, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                        >
                            <FaPause /> Freeze
                        </button>
                    ) : (
                        <button
                            onClick={() => onRepublish(offer)}
                            className="premium-action-btn"
                            style={{ ...btnBaseStyle, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                        >
                            <FaPlay /> Re-Publish
                        </button>
                    )}

                    <button
                        onClick={() => onDelete(offer)}
                        className="premium-action-btn"
                        style={{ ...btnBaseStyle, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                    >
                        <FaTrash /> Delete
                    </button>
                </div>
            )}
        </div>
    );
};

const btnBaseStyle = {
    flex: 1,
    height: '48px', // Strict 48px height globally enforced
    borderRadius: '8px', // Strict 8px radius
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
};

export default PremiumOfferCard;
