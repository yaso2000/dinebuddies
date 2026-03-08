/**
 * SlideTemplate.jsx
 * Multi-slide carousel format (displayed at 400×400px per slide).
 * Renders a single slide at a time — parent manages currentSlide index.
 * ISOLATED — part of social-creator feature only.
 */
import React from 'react';

const ANIMATION_STYLES = {
    fadeIn: { animationName: 'sc-fadeIn', animationDuration: '0.6s' },
    slideUp: { animationName: 'sc-slideUp', animationDuration: '0.55s' },
    slideLeft: { animationName: 'sc-slideLeft', animationDuration: '0.55s' },
    zoomIn: { animationName: 'sc-zoomIn', animationDuration: '0.55s' },
    glow: { animationName: 'sc-fadeIn', animationDuration: '0.4s' },
    none: {},
};

// slide number pill colors cycling
const PILL_COLORS = ['#8b5cf6', '#f97316', '#10b981', '#3b82f6', '#ec4899'];

const SingleSlide = ({ slide, index, total, accentColor, animation, logoUrl, logoEmoji, businessName, textColor, bgColor, bgGradient }) => {
    const anim = ANIMATION_STYLES[animation] || ANIMATION_STYLES.slideLeft;
    const pillColor = PILL_COLORS[index % PILL_COLORS.length];

    const bgStyle = bgGradient
        ? { background: `linear-gradient(135deg, ${bgColor}, ${accentColor}35)` }
        : { background: bgColor };

    return (
        <div
            style={{
                width: 400, height: 400, position: 'relative',
                ...bgStyle, overflow: 'hidden', borderRadius: 12,
            }}
        >
            {/* Slide number pill */}
            <div style={{
                position: 'absolute', top: 16, right: 16,
                background: `${pillColor}22`, border: `1px solid ${pillColor}55`,
                color: pillColor, borderRadius: 20, padding: '3px 10px',
                fontSize: '0.68rem', fontWeight: 800,
                animation: 'sc-fadeIn 0.4s both',
            }}>
                {index + 1} / {total}
            </div>

            {/* Logo small top-left */}
            <div style={{
                position: 'absolute', top: 16, left: 16,
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'sc-fadeIn 0.4s both',
            }}>
                <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: logoUrl ? `url(${logoUrl}) center/cover` : accentColor,
                    border: '2px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem',
                }}>{!logoUrl && logoEmoji}</div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: `${textColor}cc` }}>{businessName}</span>
            </div>

            {/* Decorative BG blob */}
            <div style={{
                position: 'absolute', bottom: '-30%', right: '-15%',
                width: 220, height: 220, borderRadius: '50%',
                background: `${accentColor}15`, pointerEvents: 'none',
            }} />

            {/* Accent line left */}
            <div style={{
                position: 'absolute', left: 24, top: 72, width: 3, height: 36,
                borderRadius: 2, background: accentColor,
                animation: 'sc-fadeIn 0.4s both 0.1s', animationFillMode: 'both',
            }} />

            {/* Slide headline */}
            <div style={{
                position: 'absolute', left: 38, right: 28, top: 72,
                fontSize: slide.headline?.length > 30 ? '1.3rem' : '1.65rem',
                fontWeight: 900, color: textColor, lineHeight: 1.2,
                ...anim, animationFillMode: 'both', animationDelay: '0.12s',
            }}>
                {animation === 'glow'
                    ? <span style={{ animation: 'sc-glow 2s ease-in-out infinite', color: accentColor }}>{slide.headline}</span>
                    : slide.headline || `Slide ${index + 1}`
                }
            </div>

            {/* Slide body text */}
            <div style={{
                position: 'absolute', left: 38, right: 28,
                top: slide.headline?.length > 30 ? 210 : 190,
                fontSize: '0.88rem', color: `${textColor}cc`, lineHeight: 1.5, fontWeight: 500,
                ...anim, animationFillMode: 'both', animationDelay: '0.22s',
            }}>
                {slide.body || ''}
            </div>

            {/* Bottom bar */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}33)`,
            }} />
        </div>
    );
};

const SlideTemplate = ({ config, currentSlide, previewRef }) => {
    const { slides = [], accentColor = '#8b5cf6', bgColor = '#0f0f1a', textColor = '#fff', animation = 'slideLeft', logoUrl = null, logoEmoji = '🏪', businessName = 'Business', bgGradient = true } = config;

    const slide = slides[currentSlide] || { headline: `Slide ${currentSlide + 1}`, body: '' };

    return (
        <div ref={previewRef} className="sc-canvas" style={{ width: 400, height: 400 }}>
            <SingleSlide
                key={`slide-${currentSlide}`}   // re-mounts on change → triggers animation
                slide={slide}
                index={currentSlide}
                total={slides.length}
                accentColor={accentColor}
                animation={animation}
                logoUrl={logoUrl}
                logoEmoji={logoEmoji}
                businessName={businessName}
                textColor={textColor}
                bgColor={bgColor}
                bgGradient={bgGradient}
            />
        </div>
    );
};

export default SlideTemplate;
