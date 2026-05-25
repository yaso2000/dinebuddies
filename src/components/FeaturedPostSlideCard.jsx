/**
 * Renders one Elite featured post slide.
 * Animation loops every ~6s (play → wait → play).
 * @refresh reset
 */
import React, { useState, useEffect, useRef } from 'react';
import { pickSafeDisplayImageUrl } from '../utils/avatarUtils';

export const ICON_OPTIONS = {
    none: null,
    star: '⭐',
    crown: '👑',
    fire: '🔥',
    heart: '❤️',
    check: '✅',
    gift: '🎁',
    trophy: '🏆',
};
export const EMOJI_GRID = ['', '⭐', '👑', '🔥', '❤️', '✅', '🎁', '🏆', '✨', '💎', '🌟', '🎯', '👍', '💪', '🎉'];

export const FONT_FAMILIES = [
    'Inter, sans-serif',
    'Playfair Display, serif',
    'Oswald, sans-serif',
    'Montserrat, sans-serif',
    'Pacifico, cursive',
    'system-ui, sans-serif',
];

export const LAYOUT_OPTIONS = [
    { value: 'center',  label: 'Center', justifyContent: 'center',     alignItems: 'center' },
    { value: 'top',     label: 'Top',    justifyContent: 'flex-start',  alignItems: 'center' },
    { value: 'bottom',  label: 'Bottom', justifyContent: 'flex-end',    alignItems: 'center' },
    { value: 'left',    label: 'Left',   justifyContent: 'center',      alignItems: 'flex-start' },
    { value: 'right',   label: 'Right',  justifyContent: 'center',      alignItems: 'flex-end' },
];

export const ANIMATION_OPTIONS = ['none', 'stagger', 'fade', 'slideUp', 'slideLeft', 'scale'];

export function getBackgroundStyle(background) {
    if (!background) return { background: '#1e1e2e' };
    const { type, value } = background;
    if (type === 'gradient' && value) return { background: value };
    if (type === 'image' && value) return { backgroundImage: `url(${pickSafeDisplayImageUrl(value)})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    return { background: value || '#1e1e2e' };
}

export default function FeaturedPostSlideCard({ data, businessName, businessLogoUrl, playEntrance = true, compact = false, onOverflow, noRadius = false }) {
    const [animState, setAnimState] = useState(() => {
        const animKey = data?.animation || 'stagger';
        return (!playEntrance || animKey === 'none') ? 'static' : 'waiting';
    });
    
    const containerRef = useRef(null);
    const contentRef   = useRef(null);

    const title       = data?.title       || {};
    const description = data?.description || {};
    const rawDur = typeof data?.animationDuration === 'number' ? data.animationDuration : 0.5;
    const dur    = Math.min(5, Math.max(0.1, rawDur));

    // Scroll-triggered animation: wait until 50% visible, play once, stop at final frame
    useEffect(() => {
        if (animState !== 'waiting') return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setAnimState('entrance');
                observer.disconnect();
            }
        }, { threshold: 0.5 });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [animState]);

    // Overflow detection — notifies parent when content exceeds card height
    useEffect(() => {
        if (!contentRef.current || !onOverflow) return;
        const el = contentRef.current;
        const overflowed = el.scrollHeight > el.clientHeight + 4;
        onOverflow(overflowed);
    });

    // ── Styles ──────────────────────────────────────────────────────────────
    const bgStyle      = getBackgroundStyle(data?.background);
    const borderWidth  = title?.borderWidth != null ? Number(title.borderWidth) : 0;
    const borderColor  = title?.borderColor  || '#000000';
    const shadowColor  = title?.shadowColor  || 'rgba(0,0,0,0.4)';
    const hasShadow    = title?.shadow !== false && title?.shadow !== 'off';

    const descBW       = description?.borderWidth != null ? Number(description.borderWidth) : 0;
    const descBC       = description?.borderColor  || '#000000';
    const descSC       = description?.shadowColor  || 'rgba(0,0,0,0.4)';
    const descShadow   = description?.shadow !== false && description?.shadow !== 'off';

    const descStyle = {
        fontFamily: description?.fontFamily || 'system-ui, sans-serif',
        fontSize:   description?.fontSize ? `${description.fontSize}px` : '0.95rem',
        color:      description?.color    || 'rgba(255,255,255,0.9)',
        fontWeight: description?.fontWeight === 'bold'   ? 700     : 400,
        fontStyle:  description?.fontStyle  === 'italic' ? 'italic': 'normal',
        textAlign:  description?.textAlign  || 'left',
        margin:     0,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak:  'break-word',
        ...(descBW > 0 && { WebkitTextStroke: `${descBW}px ${descBC}` }),
        ...(descShadow  && { textShadow: `0 2px 8px ${descSC}` }),
    };

    const paragraphs = description?.mode === 'paragraphs' && Array.isArray(description?.paragraphs)
        ? description.paragraphs
        : [description?.singleText || description?.text].filter(Boolean);
    const paragraphIcons      = Array.isArray(description?.paragraphIcons)      ? description.paragraphIcons      : ['','','','',''];
    const paragraphIconsAfter = Array.isArray(description?.paragraphIconsAfter) ? description.paragraphIconsAfter : ['','','','',''];
    const descPosition = description?.positionVertical || 'center';
    const descJustify  = descPosition === 'top' ? 'flex-start' : descPosition === 'bottom' ? 'flex-end' : 'center';

    const titleStyle = {
        fontFamily: title?.fontFamily || 'Inter, sans-serif',
        fontSize:   title?.fontSize   ? `${title.fontSize}px` : '1.75rem',
        color:      title?.color      || '#fff',
        fontWeight: title?.fontWeight === 'bold'   ? 700     : 400,
        fontStyle:  title?.fontStyle  === 'italic' ? 'italic': 'normal',
        textAlign:  title?.textAlign  || 'left',
        margin: 0, lineHeight: 1.2, width: '100%',
        wordBreak: 'break-word', overflowWrap: 'break-word',
        ...(borderWidth > 0 && { WebkitTextStroke: `${borderWidth}px ${borderColor}` }),
        ...(hasShadow      && { textShadow: `0 2px 8px ${shadowColor}` }),
    };

    const layoutKey   = data?.layout    || 'center';
    const layoutStyle = LAYOUT_OPTIONS.find(l => l.value === layoutKey) || LAYOUT_OPTIONS[0];
    const animKey     = data?.animation || 'stagger';
    const baseClass   = `elite-slide-${animState} elite-slide-anim-${animKey}`;
    const cardStyle   = {
        position: 'relative', overflow: 'hidden',
        borderRadius: noRadius ? 0 : 16,
        boxSizing: 'border-box',
        padding: compact ? '24px 16px' : '80px 24px', // Symmetric top/bottom margins, larger than before
        width: '100%',
        minHeight: '56.25cqw', // 16:9 ratio
        maxHeight: '177.77cqw', // 9:16 ratio
        height: 'auto',
        maxWidth: (compact && !noRadius) ? 420 : '100%',
        ...bgStyle,
    };

    return (
        <div style={{ containerType: 'inline-size', width: '100%' }}>
            <div ref={containerRef} className={`elite-featured-slide ${baseClass}`} style={cardStyle}>
            <style>{`
                .elite-slide-waiting .elite-slide-title, .elite-slide-waiting .elite-slide-desc, .elite-slide-waiting .elite-slide-para { opacity: 0; }
                .elite-slide-entrance .elite-slide-title { opacity: 0; animation: eliteFadeInUp ${dur}s ease forwards; animation-delay: 0.1s; }
                .elite-slide-entrance.elite-slide-anim-stagger  .elite-slide-title { transform: translateY(12px); }
                .elite-slide-entrance.elite-slide-anim-fade     .elite-slide-title { transform: none; animation-name: eliteFadeIn; }
                .elite-slide-entrance.elite-slide-anim-slideUp  .elite-slide-title { transform: translateY(20px); }
                .elite-slide-entrance.elite-slide-anim-slideLeft .elite-slide-title { transform: translateX(20px); animation-name: eliteFadeInRight; }
                .elite-slide-entrance.elite-slide-anim-scale    .elite-slide-title { transform: scale(0.9); animation-name: eliteScaleIn; }
                .elite-slide-entrance .elite-slide-desc { opacity: 0; animation: eliteFadeInUp ${dur}s ease forwards; animation-delay: 0.35s; }
                .elite-slide-static .elite-slide-desc, .elite-slide-entrance .elite-slide-desc { display: flex; flex-direction: column; gap: 6px; }
                .elite-slide-desc { display: flex; flex-direction: column; gap: 6px; }
                .elite-slide-entrance.elite-slide-anim-stagger  .elite-slide-desc { transform: translateY(8px); }
                .elite-slide-entrance.elite-slide-anim-fade     .elite-slide-desc { transform: none; animation-name: eliteFadeIn; }
                .elite-slide-entrance.elite-slide-anim-slideUp  .elite-slide-desc { transform: translateY(12px); }
                .elite-slide-entrance.elite-slide-anim-slideLeft .elite-slide-desc { transform: translateX(12px); animation-name: eliteFadeInRight; animation-delay: 0.4s; }
                .elite-slide-entrance.elite-slide-anim-scale    .elite-slide-desc { transform: scale(0.95); animation-name: eliteScaleIn; animation-delay: 0.4s; }
                .elite-slide-entrance .elite-slide-para { opacity: 0; animation: eliteFadeInUp ${Math.min(dur * 0.6, 1)}s ease forwards; }
                .elite-slide-entrance .elite-slide-para-0 { animation-delay: ${(dur * 0.30).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-1 { animation-delay: ${(dur * 0.45).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-2 { animation-delay: ${(dur * 0.60).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-3 { animation-delay: ${(dur * 0.75).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-4 { animation-delay: ${(dur * 0.90).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-5 { animation-delay: ${(dur * 1.05).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-6 { animation-delay: ${(dur * 1.20).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-7 { animation-delay: ${(dur * 1.35).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-8 { animation-delay: ${(dur * 1.50).toFixed(2)}s; }
                .elite-slide-entrance .elite-slide-para-9 { animation-delay: ${(dur * 1.65).toFixed(2)}s; }
                .elite-slide-entrance.elite-slide-anim-stagger  .elite-slide-para { transform: translateY(8px); }
                .elite-slide-entrance.elite-slide-anim-slideUp  .elite-slide-para { transform: translateY(12px); }
                .elite-slide-entrance.elite-slide-anim-slideLeft .elite-slide-para { transform: translateX(10px); animation-name: eliteFadeInRight; }
                .elite-slide-entrance.elite-slide-anim-scale    .elite-slide-para { transform: scale(0.95); animation-name: eliteScaleIn; }
                .elite-slide-entrance.elite-slide-anim-fade     .elite-slide-para { transform: none; animation-name: eliteFadeIn; }
                @keyframes eliteFadeInUp   { to { opacity: 1; transform: translateY(0); } }
                @keyframes eliteFadeInRight { to { opacity: 1; transform: translateX(0); } }
                @keyframes eliteFadeIn     { to { opacity: 1; } }
                @keyframes eliteScaleIn    { to { opacity: 1; transform: scale(1); } }
            `}</style>

            <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: layoutStyle.justifyContent, alignItems: layoutStyle.alignItems }}>
                {/* Title + Description always grouped — title is 20px above paragraphs */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Title */}
                    <h2 className="elite-slide-title" style={{ ...titleStyle, marginBottom: 20 }}>{title?.text || 'Title'}</h2>

                    {/* Paragraphs */}
                    <div className="elite-slide-desc" style={{ textAlign: description?.textAlign || 'left' }}>
                        {paragraphs.map((p, i) => {
                            if (!p || !String(p).trim()) return null;
                            const isBoxOn = !!description?.boxEnabled;
                            const bBg = (typeof description?.boxBg === 'string' ? description.boxBg : null) || '#000000';
                            const bOp = (typeof description?.boxOpacity === 'number' ? description.boxOpacity : null) ?? 0.4;
                            const bBW = (typeof description?.boxBorderWidth === 'number' ? description.boxBorderWidth : null) ?? 0;
                            const bBC = (typeof description?.boxBorderColor === 'string' ? description.boxBorderColor : null) || '#ffffff';
                            const bBR = (typeof description?.boxBorderRadius === 'number' ? description.boxBorderRadius : null) ?? 12;
                            const rr = parseInt(bBg.slice(1, 3), 16) || 0;
                            const gg = parseInt(bBg.slice(3, 5), 16) || 0;
                            const bb = parseInt(bBg.slice(5, 7), 16) || 0;
                            const paraBoxStyle = isBoxOn ? {
                                background:   `rgba(${rr},${gg},${bb},${bOp})`,
                                border:       bBW > 0 ? `${bBW}px solid ${bBC}` : 'none',
                                borderRadius: bBR,
                                padding:      '6px 10px',
                            } : {};
                            return (
                                <div key={i} className={`elite-slide-para elite-slide-para-${i}`} style={{ ...paraBoxStyle, textAlign: description?.textAlign || 'left' }}>
                                    <p style={{ ...descStyle, margin: 0 }}>
                                        {paragraphIcons[i] && (
                                            <span style={{ fontSize: descStyle.fontSize, marginRight: 6, display: 'inline-block' }}>
                                                {paragraphIcons[i]}
                                            </span>
                                        )}
                                        {p}
                                        {paragraphIconsAfter[i] && (
                                            <span style={{ fontSize: descStyle.fontSize, marginLeft: 6, display: 'inline-block' }}>
                                                {paragraphIconsAfter[i]}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}
