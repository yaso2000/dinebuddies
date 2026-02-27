import React from 'react';

/**
 * AnimatedOfferIcon - Replaces static emojis with highly animated SVG icons.
 * Uses pure CSS keyframes defined within the rendering layer to keep it self-contained
 * and extremely performant.
 */
const AnimatedOfferIcon = ({ type, size = '100%', color = 'currentColor', className = '' }) => {
    const renderIcon = () => {
        switch (type) {
            case 'PoliceLight': // Urgent / 🚨
                return (
                    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={`anim-police-light ${className}`}>
                        {/* Base */}
                        <path d="M20 75 Q 50 85 80 75 L 75 90 Q 50 100 25 90 Z" fill="#333" />
                        {/* Glass Dome */}
                        <path d="M20 75 C 20 40, 80 40, 80 75 Z" fill="rgba(255, 60, 60, 0.4)" stroke="#ff2a2a" strokeWidth="2" />
                        {/* Rotating Core (Animated) */}
                        <g className="siren-core" transform="origin: center">
                            <rect x="45" y="45" width="10" height="30" fill="#fff" rx="4" />
                            <ellipse cx="50" cy="55" rx="20" ry="10" fill="url(#siren-glow)" />
                        </g>

                        {/* Defs for gradients */}
                        <defs>
                            <radialGradient id="siren-glow" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#ff0000" stopOpacity="0.9" />
                                <stop offset="50%" stopColor="#ff5555" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <style>{`
                            @keyframes sirenSpin {
                                0% { transform: scaleX(1); filter: brightness(1) drop-shadow(0 0 10px red); }
                                50% { transform: scaleX(0.1); filter: brightness(2) drop-shadow(0 0 30px #ff5555); }
                                100% { transform: scaleX(1); filter: brightness(1) drop-shadow(0 0 10px red); }
                            }
                            .anim-police-light .siren-core {
                                transform-origin: 50% 60%;
                                animation: sirenSpin 0.6s infinite ease-in-out;
                            }
                        `}</style>
                    </svg>
                );

            case 'Loudspeaker': // Announcements / 📢
                return (
                    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={`anim-loudspeaker ${className}`}>
                        {/* Speaker Body */}
                        <path d="M15 40 L 40 40 L 65 20 L 70 20 L 70 80 L 65 80 L 40 60 L 15 60 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="3" strokeLinejoin="round" />
                        {/* Handle */}
                        <path d="M30 60 L 30 75 Q 30 85 40 85 L 45 85" fill="none" stroke="#d97706" strokeWidth="6" strokeLinecap="round" />
                        {/* Soundwaves (Animated) */}
                        <path className="wave wave-1" d="M 80 35 Q 90 50 80 65" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                        <path className="wave wave-2" d="M 88 28 Q 105 50 88 72" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />

                        <style>{`
                            @keyframes speakerShake {
                                0%, 100% { transform: rotate(0deg); }
                                25% { transform: rotate(-5deg); }
                                75% { transform: rotate(5deg); }
                            }
                            @keyframes wavePulse1 {
                                0%, 100% { opacity: 0.3; transform: translateX(0); }
                                50% { opacity: 1; transform: translateX(2px); filter: drop-shadow(0 0 5px orange); }
                            }
                            @keyframes wavePulse2 {
                                0%, 100% { opacity: 0.1; transform: translateX(0); }
                                50% { opacity: 1; transform: translateX(4px); filter: drop-shadow(0 0 8px orange); }
                            }
                            .anim-loudspeaker {
                                transform-origin: 30% 50%;
                                animation: speakerShake 2s infinite ease-in-out;
                            }
                            .anim-loudspeaker .wave-1 { animation: wavePulse1 1s infinite alternate; }
                            .anim-loudspeaker .wave-2 { animation: wavePulse2 1s infinite alternate 0.3s; }
                        `}</style>
                    </svg>
                );

            case 'Fire': // Hot Deal / 🔥
                return (
                    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={`anim-fire ${className}`}>
                        {/* Main Flame */}
                        <path className="flame-outer" d="M50 10 Q 75 40 75 70 A 25 25 0 0 1 25 70 Q 25 40 50 10 Z" fill="url(#fire-gradient-outer)" />
                        {/* Inner Flame */}
                        <path className="flame-inner" d="M50 35 Q 65 55 65 75 A 15 15 0 0 1 35 75 Q 35 55 50 35 Z" fill="url(#fire-gradient-inner)" />
                        {/* Embers */}
                        <circle className="ember ember-1" cx="40" cy="80" r="2" fill="#fff" />
                        <circle className="ember ember-2" cx="60" cy="70" r="3" fill="#ffeaa7" />

                        <defs>
                            <linearGradient id="fire-gradient-outer" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#ff0000" />
                                <stop offset="100%" stopColor="#ff7f50" />
                            </linearGradient>
                            <linearGradient id="fire-gradient-inner" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#ffb142" />
                                <stop offset="100%" stopColor="#feca57" />
                            </linearGradient>
                        </defs>
                        <style>{`
                            @keyframes flameWobbleOuter {
                                0%, 100% { transform: scale(1) skewX(0deg); filter: drop-shadow(0 0 10px #ff4757); }
                                25% { transform: scale(1.05, 0.95) skewX(-2deg); }
                                75% { transform: scale(0.95, 1.05) skewX(2deg); filter: drop-shadow(0 0 20px #ff6348); }
                            }
                            @keyframes flameWobbleInner {
                                0%, 100% { transform: scale(1) skewX(0deg); }
                                33% { transform: scale(0.9, 1.1) skewX(3deg); }
                                66% { transform: scale(1.1, 0.9) skewX(-3deg); filter: brightness(1.2); }
                            }
                            @keyframes emberDrift {
                                0% { transform: translateY(0) scale(1); opacity: 1; }
                                100% { transform: translateY(-30px) scale(0); opacity: 0; }
                            }
                            .anim-fire .flame-outer { transform-origin: 50% 90%; animation: flameWobbleOuter 1.5s infinite ease-in-out; }
                            .anim-fire .flame-inner { transform-origin: 50% 90%; animation: flameWobbleInner 1.2s infinite ease-in-out; }
                            .anim-fire .ember-1 { animation: emberDrift 1s infinite ease-out; }
                            .anim-fire .ember-2 { animation: emberDrift 1.5s infinite ease-out 0.5s; }
                        `}</style>
                    </svg>
                );

            case 'Sparkles': // New / Premium / ✨
                return (
                    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={`anim-sparkles ${className}`}>
                        {/* Large Star */}
                        <path className="star star-lg" d="M50 10 Q 55 45 90 50 Q 55 55 50 90 Q 45 55 10 50 Q 45 45 50 10 Z" fill="url(#gold-gradient)" />
                        {/* Small Star 1 */}
                        <path className="star star-sm1" d="M20 15 Q 22 28 35 30 Q 22 32 20 45 Q 18 32 5 30 Q 18 28 20 15 Z" fill="#fbc531" />
                        {/* Small Star 2 */}
                        <path className="star star-sm2" d="M80 65 Q 82 73 90 75 Q 82 77 80 85 Q 78 77 70 75 Q 78 73 80 65 Z" fill="#fff" />

                        <defs>
                            <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#fff2ab" />
                                <stop offset="50%" stopColor="#f5b041" />
                                <stop offset="100%" stopColor="#e67e22" />
                            </linearGradient>
                        </defs>
                        <style>{`
                            @keyframes twinkleLg {
                                0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; filter: drop-shadow(0 0 10px #f39c12); }
                                50% { transform: scale(1.1) rotate(10deg); opacity: 0.8; filter: drop-shadow(0 0 20px #f1c40f); }
                            }
                            @keyframes twinkleSm {
                                0%, 100% { transform: scale(0.5) rotate(0deg); opacity: 0.3; }
                                50% { transform: scale(1.2) rotate(45deg); opacity: 1; filter: drop-shadow(0 0 5px gold); }
                            }
                            .anim-sparkles .star-lg { transform-origin: 50% 50%; animation: twinkleLg 2.5s infinite ease-in-out; }
                            .anim-sparkles .star-sm1 { transform-origin: 20% 30%; animation: twinkleSm 1.5s infinite ease-in-out; }
                            .anim-sparkles .star-sm2 { transform-origin: 80% 75%; animation: twinkleSm 2s infinite ease-in-out 0.7s; }
                        `}</style>
                    </svg>
                );

            case 'Collision': // Explosion / Discount / 💥
                return (
                    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={`anim-collision ${className}`}>
                        {/* Explosion Spikes */}
                        <polygon className="boom-bg" points="50,5 65,35 95,20 80,45 100,65 70,75 85,95 50,85 15,95 30,75 0,65 20,45 5,20 35,35" fill="#e74c3c" stroke="#c0392b" strokeWidth="2" />
                        {/* Inner Blast */}
                        <polygon className="boom-fg" points="50,20 60,40 85,30 75,50 90,65 65,70 75,85 50,75 25,85 35,70 10,65 25,50 15,30 40,40" fill="#f1c40f" />
                        {/* Text (Optional, keeping it geometric) */}
                        <path className="shockwave" d="M 50 35 A 15 15 0 0 1 50 65 A 15 15 0 0 1 50 35 Z" fill="none" stroke="#fff" strokeWidth="4" />

                        <style>{`
                            @keyframes explodePulseBg {
                                0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px #c0392b); }
                                20% { transform: scale(1.15) rotate(5deg); filter: drop-shadow(0 0 15px #e74c3c); }
                            }
                            @keyframes explodePulseFg {
                                0%, 100% { transform: scale(1); }
                                20% { transform: scale(1.2) rotate(-10deg); filter: brightness(1.2); }
                            }
                            @keyframes shockRing {
                                0% { transform: scale(0.1); opacity: 1; stroke-width: 8; }
                                50% { transform: scale(3); opacity: 0; stroke-width: 1; }
                                100% { transform: scale(3); opacity: 0; }
                            }
                            .anim-collision { transform-origin: 50% 50%; }
                            .anim-collision .boom-bg { transform-origin: 50% 50%; animation: explodePulseBg 1.5s infinite ease-out; }
                            .anim-collision .boom-fg { transform-origin: 50% 50%; animation: explodePulseFg 1.5s infinite ease-out 0.05s; }
                            .anim-collision .shockwave { transform-origin: 50% 50%; animation: shockRing 3s infinite ease-out; }
                        `}</style>
                    </svg>
                );

        }

        if (type.startsWith('Discount')) {
            const percent = type.replace('Discount', '') + '%';
            return (
                <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={`anim-discount ${className}`}>
                    {/* Tag Body */}
                    <path d="M 5 20 L 75 20 L 95 50 L 75 80 L 5 80 Z" fill="url(#discount-grad)" stroke="#e74c3c" strokeWidth="2" />
                    {/* Hole */}
                    <circle cx="15" cy="50" r="5" fill="#1a1a1a" />
                    {/* Text */}
                    <text x="50" y="59" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="28" fill="#fff" textAnchor="middle" filter="drop-shadow(1px 2px 2px rgba(0,0,0,0.5))">
                        {percent}
                    </text>

                    <defs>
                        <linearGradient id="discount-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ff4757" />
                            <stop offset="100%" stopColor="#ff6b81" />
                        </linearGradient>
                    </defs>
                    <style>{`
                        @keyframes tagPulseSwing {
                            0%, 100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 5px rgba(255, 71, 87, 0.4)); }
                            50% { transform: scale(1.08) rotate(-4deg); filter: drop-shadow(0 0 15px rgba(255, 71, 87, 0.9)); }
                        }
                        .anim-discount { transform-origin: 50% 50%; animation: tagPulseSwing 2s infinite ease-in-out; }
                    `}</style>
                </svg>
            );
        }

        switch (type) {
            default:
                // Fallback to Sparkles
                return <AnimatedOfferIcon type="Sparkles" size={size} color={color} className={className} />;
        }
    };

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
            {renderIcon()}
        </div>
    );
};

export default AnimatedOfferIcon;
