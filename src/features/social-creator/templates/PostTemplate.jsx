/**
 * PostTemplate.jsx
 * Square 1:1 post format (displayed at 400×400px).
 * ISOLATED — part of social-creator feature only.
 */
import React from 'react';

const ANIMATION_STYLES = {
    fadeIn: { animationName: 'sc-fadeIn', animationDuration: '0.8s' },
    slideUp: { animationName: 'sc-slideUp', animationDuration: '0.7s' },
    slideLeft: { animationName: 'sc-slideLeft', animationDuration: '0.7s' },
    zoomIn: { animationName: 'sc-zoomIn', animationDuration: '0.7s' },
    glow: { animationName: 'sc-fadeIn', animationDuration: '0.5s' },
    none: {},
};

const PostTemplate = ({ config, previewRef }) => {
    const {
        headline = 'Your Headline',
        subtext = 'Add your message here',
        bgColor = '#0f0f1a',
        accentColor = '#f97316',
        textColor = '#ffffff',
        animation = 'zoomIn',
        logoUrl = null,
        logoEmoji = '🏪',
        businessName = 'Business',
        bgGradient = true,
    } = config;

    const anim = ANIMATION_STYLES[animation] || ANIMATION_STYLES.fadeIn;

    const bgStyle = bgGradient
        ? { background: `linear-gradient(135deg, ${bgColor} 0%, ${accentColor}33 100%)` }
        : { background: bgColor };

    return (
        <div
            ref={previewRef}
            className="sc-canvas"
            style={{
                width: 400,
                height: 400,
                position: 'relative',
                ...bgStyle,
                overflow: 'hidden',
            }}
        >
            {/* Top accent line */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)`,
            }} />

            {/* Decorative circle BG */}
            <div style={{
                position: 'absolute', top: '-40%', right: '-20%',
                width: 280, height: 280, borderRadius: '50%',
                background: `${accentColor}12`, pointerEvents: 'none',
            }} />

            {/* Left accent bar */}
            <div style={{
                position: 'absolute', left: 20, top: 40, bottom: 40,
                width: 3, borderRadius: 2, background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}22)`,
                animation: 'sc-fadeIn 0.4s both',
            }} />

            {/* Logo + Business Name — top left */}
            <div style={{
                position: 'absolute', top: 28, left: 36,
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'sc-fadeIn 0.5s both',
            }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: logoUrl ? `url(${logoUrl}) center/cover` : accentColor,
                    border: '2px solid rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', flexShrink: 0,
                }}>
                    {!logoUrl && logoEmoji}
                </div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '0.78rem', color: textColor }}>{businessName}</div>
                    <div style={{ fontSize: '0.62rem', color: `${textColor}66`, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Official</div>
                </div>
            </div>

            {/* Headline — center */}
            <div
                className="sc-text-headline"
                style={{
                    top: '50%',
                    transform: 'translateY(-60%)',
                    fontSize: headline.length > 25 ? '1.5rem' : '2rem',
                    color: textColor,
                    ...anim,
                    animationFillMode: 'both',
                    animationDelay: '0.1s',
                }}
            >
                {animation === 'glow'
                    ? <span style={{ animation: 'sc-glow 2s ease-in-out infinite', color: accentColor }}>{headline}</span>
                    : headline
                }
            </div>

            {/* Subtext */}
            <div
                className="sc-text-sub"
                style={{
                    top: '50%',
                    transform: 'translateY(40%)',
                    fontSize: '0.88rem',
                    color: `${textColor}bb`,
                    ...anim,
                    animationFillMode: 'both',
                    animationDelay: '0.25s',
                }}
            >
                {subtext}
            </div>

            {/* Bottom accent strip */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 4, background: `linear-gradient(90deg, ${accentColor}44, ${accentColor})`,
            }} />
        </div>
    );
};

export default PostTemplate;
