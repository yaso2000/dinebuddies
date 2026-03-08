/**
 * StoryTemplate.jsx
 * Vertical 9:16 story format (displayed at 337×600px, exported at 2×).
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

const StoryTemplate = ({ config, previewRef }) => {
    const {
        headline = 'Your Headline',
        subtext = 'Add your message here',
        bgColor = '#1a1a2e',
        accentColor = '#8b5cf6',
        textColor = '#ffffff',
        animation = 'slideUp',
        logoUrl = null,
        logoEmoji = '🏪',
        businessName = 'Business',
    } = config;

    const anim = ANIMATION_STYLES[animation] || ANIMATION_STYLES.fadeIn;

    const bgStyle = config.bgGradient
        ? { background: `linear-gradient(160deg, ${bgColor}, ${accentColor}99)` }
        : { background: bgColor };

    return (
        <div
            ref={previewRef}
            className="sc-canvas"
            style={{
                width: 337,
                height: 600,
                position: 'relative',
                ...bgStyle,
                overflow: 'hidden',
            }}
        >
            {/* Background decorative circles */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: `${accentColor}20`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -80, left: -80, width: 260, height: 260, borderRadius: '50%', background: `${accentColor}15`, pointerEvents: 'none' }} />

            {/* Logo */}
            <div
                className="sc-logo-box"
                style={{
                    top: 40,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: logoUrl ? `url(${logoUrl})` : accentColor,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                {!logoUrl && <span style={{ fontSize: '2.4rem' }}>{logoEmoji}</span>}
            </div>

            {/* Business name */}
            <div style={{
                position: 'absolute', top: 124, left: 0, right: 0,
                textAlign: 'center', fontSize: '0.8rem', fontWeight: 800,
                color: `${textColor}99`, letterSpacing: '2px', textTransform: 'uppercase',
                animation: `sc-fadeIn 0.5s both 0.1s`,
                animationFillMode: 'both',
            }}>
                {businessName}
            </div>

            {/* Divider */}
            <div style={{
                position: 'absolute', top: 148, left: '50%', transform: 'translateX(-50%)',
                width: 48, height: 3, borderRadius: 2, background: accentColor,
                animation: 'sc-fadeIn 0.5s both 0.2s', animationFillMode: 'both',
            }} />

            {/* Headline */}
            <div
                className="sc-text-headline"
                style={{
                    top: 170,
                    fontSize: headline.length > 30 ? '1.6rem' : '2rem',
                    color: textColor,
                    ...anim,
                    animationFillMode: 'both',
                    animationDelay: '0.15s',
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
                    top: headline.length > 30 ? 310 : 290,
                    fontSize: '0.95rem',
                    color: `${textColor}cc`,
                    ...anim,
                    animationFillMode: 'both',
                    animationDelay: '0.25s',
                }}
            >
                {subtext}
            </div>

            {/* Bottom accent bar */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 5, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)`,
            }} />

            {/* Watermark */}
            <div style={{
                position: 'absolute', bottom: 16, right: 16,
                fontSize: '0.6rem', color: `${textColor}44`, fontWeight: 700, letterSpacing: '1px',
            }}>
                DineBuddies
            </div>
        </div>
    );
};

export default StoryTemplate;
