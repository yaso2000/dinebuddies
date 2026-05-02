import React from 'react';
import { MOTION_THEMES, hexToRgba, motionThemeCanvasBackground, motionThemeOutlineBorder, type MotionThemeId } from '../theme/themeTokens';
import type { MotionAnimation } from './registry';
import {
    MOTION_CARD_ROOT_STYLE,
    motionCardRootStyleForPreviewAspect,
    motionContentPadding,
    motionCoverScrim,
    motionCtaButtonStyle,
    motionCtaLabelContrastStyle,
    motionHeroTitleLines,
    motionImageObjectPosition,
    motionReadabilityMuted,
    motionThemeCtaGradient,
    motionThemeCtaLayeredShadow,
    motionSubtitleClamp,
    motionDescriptionClamp,
    motionDetailsCardBodyTight,
    renderHighlightedMotionText,
    useCoverLuminance,
    useMotionCardWidth,
    type MotionPreviewAspect,
    type MotionPreviewDesign,
} from './motionTemplateShared';

export type SpecialOfferTemplateProps = {
    content: {
        title: string;
        subtitle?: string;
        description?: string;
        cta?: string;
        badgeText?: string;
        imageUrl?: string;
    };
    style: {
        themeId: MotionThemeId;
        animation: MotionAnimation;
        durationMs: number;
    };
    previewAspect?: MotionPreviewAspect;
    previewDesign?: MotionPreviewDesign | null;
};

const slideName = (px: number) => `mpSoSlide_${Math.round(Math.max(3, px))}`;

function animStyle(
    animation: MotionAnimation,
    durationMs: number,
    delayMs: number,
    slidePx: number,
): React.CSSProperties {
    const base = `${durationMs}ms ease forwards`;
    const d = { animationDelay: `${delayMs}ms` };
    const y = Math.max(3, slidePx);
    const sk = slideName(slidePx);
    if (animation === 'fade') return { opacity: 0, animation: `mpSoFadeIn ${base}`, ...d };
    if (animation === 'slide') return { opacity: 0, transform: `translateY(${y}px)`, animation: `${sk} ${base}`, ...d };
    if (animation === 'pop') return { opacity: 0, transform: 'scale(0.94)', animation: `mpSoPopIn ${base}`, ...d };
    return { opacity: 0, transform: `translateY(${Math.round(y * 0.65)}px)`, animation: `${sk} ${base}`, ...d };
}

function CoverStack({
    imageUrl,
    imageOpacity,
    gradient,
    vignette,
    imgPos,
    theme,
}: {
    imageUrl?: string;
    imageOpacity: number;
    gradient: string;
    vignette?: string;
    imgPos: string;
    theme: (typeof MOTION_THEMES)[MotionThemeId];
}) {
    return (
        <>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: imgPos,
                        opacity: imageOpacity,
                        transform: 'scale(1.02)',
                    }}
                />
            ) : (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: motionThemeCanvasBackground(theme),
                    }}
                />
            )}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: gradient,
                    pointerEvents: 'none',
                    zIndex: 1,
                }}
            />
            {vignette ? (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: vignette,
                        pointerEvents: 'none',
                        zIndex: 1,
                    }}
                />
            ) : null}
        </>
    );
}

function Keyframes({ slidePx }: { slidePx: number }) {
    const sk = slideName(slidePx);
    return (
        <style>{`
            @keyframes mpSoFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes mpSoPopIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
            @keyframes ${sk} { from { opacity: 0; transform: translateY(${slidePx}px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    );
}

/** 1) Big discount / hero line — image secondary, flat scrim, CTA anchored bottom. */
export function OfferDiscountHero({ content, style, previewAspect, previewDesign }: SpecialOfferTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef, cardW] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(cardW);
    const a = previewAspect || 'square';
    const land = a === 'landscape';
    const vert = a === 'vertical';
    const lines = motionHeroTitleLines(content.title);
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.82);
    const slidePx = 14;
    const ctaBase = motionCtaButtonStyle(theme);
    const ctaLbl = motionCtaLabelContrastStyle(theme);
    const ctaShadow = motionThemeCtaLayeredShadow(theme, ctaBase.boxShadow, undefined);

    const badge = (
        <div
            className="motion-body"
            style={{
                alignSelf: 'flex-start',
                background: hexToRgba(theme.bgSecondary, 0.95),
                color: theme.textPrimary,
                borderRadius: 999,
                padding: '6px 14px',
                fontWeight: 800,
                fontSize: 'clamp(10px, 2.6cqi, 12px)',
                letterSpacing: 0.08,
                textTransform: 'uppercase',
                border: `1px solid ${hexToRgba(theme.textPrimary, 0.12)}`,
                ...animStyle(style.animation, style.durationMs, 0, slidePx),
            }}
        >
            {content.badgeText?.trim() || 'Special offer'}
        </div>
    );

    const heroSize = vert ? 'clamp(44px, 14cqi, 88px)' : land ? 'clamp(36px, 11cqi, 72px)' : 'clamp(40px, 13cqi, 84px)';

    const heroBlock = (
        <div style={{ textAlign: land ? 'left' : 'center', minWidth: 0 }}>
            {lines.intro ? (
                <div
                    className="motion-title"
                    style={{
                        fontSize: 'clamp(12px, 3cqi, 16px)',
                        fontWeight: 700,
                        color: theme.textPrimary,
                        textShadow: textBlockShadow,
                        marginBottom: '0.15em',
                        ...animStyle(style.animation, style.durationMs, 60, slidePx),
                    }}
                >
                    {renderHighlightedMotionText(lines.intro, theme, 'title')}
                </div>
            ) : null}
            <div
                className="motion-title"
                style={{
                    fontSize: heroSize,
                    fontWeight: 950,
                    lineHeight: 0.95,
                    letterSpacing: vert ? -0.02 : -0.03,
                    color: theme.textPrimary,
                    textShadow: textBlockShadow,
                    ...animStyle(style.animation, style.durationMs, 100, slidePx),
                }}
            >
                {renderHighlightedMotionText(lines.hero || content.title, theme, 'title')}
            </div>
            {lines.outro ? (
                <div
                    className="motion-title"
                    style={{
                        marginTop: 6,
                        fontSize: 'clamp(14px, 3.4cqi, 20px)',
                        fontWeight: 800,
                        color: theme.textAccent,
                        textShadow: textBlockShadow,
                        ...animStyle(style.animation, style.durationMs, 140, slidePx),
                    }}
                >
                    {renderHighlightedMotionText(lines.outro, theme, 'title')}
                </div>
            ) : null}
        </div>
    );

    const bodyBlock =
        content.subtitle || content.description ? (
            <div
                style={{
                    marginTop: land ? 8 : vert ? 14 : 12,
                    padding: land ? '8px 10px' : '10px 12px',
                    borderRadius: 12,
                    background: hexToRgba(theme.bgPrimary, 0.55),
                    border: motionThemeOutlineBorder(theme),
                    maxWidth: land ? '100%' : '100%',
                    ...animStyle(style.animation, style.durationMs, 200, slidePx),
                }}
            >
                {content.subtitle ? (
                    <p
                        className="motion-body"
                        style={{
                            ...motionSubtitleClamp,
                            ...motionDetailsCardBodyTight,
                            WebkitLineClamp: 2,
                            color: muted,
                            textShadow: previewDesign != null ? textBlockShadow : undefined,
                            margin: 0,
                        }}
                    >
                        {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                    </p>
                ) : null}
                {content.description ? (
                    <p
                        className="motion-body"
                        style={{
                            ...motionDescriptionClamp,
                            ...motionDetailsCardBodyTight,
                            WebkitLineClamp: land ? 2 : 3,
                            color: muted,
                            textShadow: previewDesign != null ? textBlockShadow : undefined,
                            margin: content.subtitle ? 6 : 0,
                        }}
                    >
                        {renderHighlightedMotionText(content.description, theme, 'body')}
                    </p>
                ) : null}
            </div>
        ) : null;

    const cta =
        content.cta ? (
            <div
                className="motion-button"
                role="presentation"
                style={{
                    ...ctaBase,
                    background: motionThemeCtaGradient(theme),
                    color: ctaLbl.color,
                    textShadow: ctaLbl.textShadow,
                    borderRadius: 12,
                    padding: land ? '10px 20px' : '12px 22px',
                    fontWeight: 900,
                    fontSize: 'clamp(12px, 3.2cqi, 16px)',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: ctaShadow,
                    marginTop: land ? 10 : vert ? 16 : 14,
                    ...animStyle(style.animation, style.durationMs, 280, slidePx),
                }}
            >
                {renderHighlightedMotionText(content.cta, theme, 'cta')}
            </div>
        ) : null;

    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;

    return (
        <div
            ref={rootRef}
            style={{
                ...frame,
                border: motionThemeOutlineBorder(theme),
                position: 'relative',
                overflow: 'hidden',
                color: theme.textPrimary,
            }}
        >
            <Keyframes slidePx={slidePx} />
            <CoverStack
                imageUrl={content.imageUrl}
                imageOpacity={imageOpacity}
                gradient={gradient}
                vignette={vignette}
                imgPos={imgPos}
                theme={theme}
            />

            {land ? (
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
                        alignItems: 'stretch',
                        padding: pad,
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minWidth: 0 }}>
                        {badge}
                        {heroBlock}
                        {bodyBlock}
                        {cta}
                    </div>
                    <div style={{ minWidth: 0 }} aria-hidden />
                </div>
            ) : vert ? (
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: pad,
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{ flex: '0 0 18%', minHeight: 0 }} />
                    <div style={{ flex: '0 0 auto' }}>{badge}</div>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
                        {heroBlock}
                        {bodyBlock}
                    </div>
                    <div style={{ flex: '0 0 auto', width: '100%' }}>{cta}</div>
                </div>
            ) : (
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        padding: pad,
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {badge}
                    <div style={{ flex: 1, minHeight: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{heroBlock}</div>
                    {bodyBlock}
                    <div style={{ marginTop: 'auto', width: '100%' }}>{cta}</div>
                </div>
            )}
        </div>
    );
}

/** 2) Luxury: dense dark overlay, inset editorial column, restrained type. */
export function OfferPremium({ content, style, previewAspect, previewDesign }: SpecialOfferTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const gradient = 'rgba(0,0,0,0.58)';
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef, cardW] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(cardW);
    const a = previewAspect || 'square';
    const land = a === 'landscape';
    const vert = a === 'vertical';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.78);
    const slidePx = 8;
    const lines = motionHeroTitleLines(content.title);
    const ctaBase = motionCtaButtonStyle(theme);
    const ctaLbl = motionCtaLabelContrastStyle(theme);
    const ctaShadow = motionThemeCtaLayeredShadow(theme, ctaBase.boxShadow, '0 12px 28px rgba(0,0,0,0.35)');

    const innerPad = vert ? '16px 18px 18px' : land ? '14px 20px' : '18px 20px 20px';
    const column: React.CSSProperties = {
        position: 'relative',
        zIndex: 2,
        margin: land ? `${pad} auto` : `${pad} auto`,
        width: land ? 'min(92%, 520px)' : vert ? 'min(94%, 340px)' : 'min(92%, 360px)',
        maxHeight: vert ? '78%' : land ? '86%' : '88%',
        overflow: 'auto',
        padding: innerPad,
        borderRadius: 4,
        background: hexToRgba(theme.bgPrimary, 0.88),
        border: `1px solid ${hexToRgba(theme.textPrimary, 0.1)}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.45)',
        display: 'grid',
        gap: vert ? 12 : land ? 10 : 14,
        boxSizing: 'border-box',
    };

    const badge = (
        <div
            style={{
                justifySelf: 'start',
                fontSize: 'clamp(9px, 2.4cqi, 11px)',
                letterSpacing: 0.14,
                textTransform: 'uppercase',
                color: theme.textAccent,
                fontWeight: 700,
                borderBottom: `1px solid ${hexToRgba(theme.textAccent, 0.35)}`,
                paddingBottom: 4,
                ...animStyle(style.animation, style.durationMs, 0, slidePx),
            }}
        >
            {content.badgeText?.trim() || 'Offer'}
        </div>
    );

    const titleEl = (
        <div style={{ display: 'grid', gap: 6 }}>
            {lines.intro ? (
                <div className="motion-title" style={{ fontSize: 'clamp(11px, 2.8cqi, 14px)', fontWeight: 600, color: muted, ...animStyle(style.animation, style.durationMs, 80, slidePx) }}>
                    {renderHighlightedMotionText(lines.intro, theme, 'title')}
                </div>
            ) : null}
            <div
                className="motion-title"
                style={{
                    fontSize: vert ? 'clamp(22px, 6.5cqi, 34px)' : land ? 'clamp(20px, 5.8cqi, 30px)' : 'clamp(24px, 6.2cqi, 36px)',
                    fontWeight: 650,
                    lineHeight: 1.15,
                    letterSpacing: 0.02,
                    color: theme.textPrimary,
                    textShadow: textBlockShadow,
                    ...animStyle(style.animation, style.durationMs, 120, slidePx),
                }}
            >
                {renderHighlightedMotionText(lines.hero || content.title, theme, 'title')}
            </div>
            {lines.outro ? (
                <div className="motion-title" style={{ fontSize: 'clamp(12px, 3cqi, 15px)', fontWeight: 600, color: theme.textAccent, ...animStyle(style.animation, style.durationMs, 160, slidePx) }}>
                    {renderHighlightedMotionText(lines.outro, theme, 'title')}
                </div>
            ) : null}
        </div>
    );

    const copy = (
        <div style={{ display: 'grid', gap: 8 }}>
            {content.subtitle ? (
                <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(11px, 2.8cqi, 13px)', lineHeight: 1.35, ...animStyle(style.animation, style.durationMs, 200, slidePx) }}>
                    {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                </p>
            ) : null}
            {content.description ? (
                <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: land ? 2 : 3, margin: 0, color: muted, fontSize: 'clamp(10px, 2.6cqi, 12px)', lineHeight: 1.4, ...animStyle(style.animation, style.durationMs, 240, slidePx) }}>
                    {renderHighlightedMotionText(content.description, theme, 'body')}
                </p>
            ) : null}
        </div>
    );

    const cta =
        content.cta ? (
            <div
                className="motion-button"
                role="presentation"
                style={{
                    ...ctaBase,
                    justifySelf: 'stretch',
                    textAlign: 'center',
                    background: motionThemeCtaGradient(theme),
                    color: ctaLbl.color,
                    textShadow: ctaLbl.textShadow,
                    borderRadius: 999,
                    padding: '11px 20px',
                    fontWeight: 700,
                    fontSize: 'clamp(12px, 3cqi, 15px)',
                    letterSpacing: 0.04,
                    border: `1px solid ${hexToRgba(theme.textPrimary, 0.2)}`,
                    boxShadow: ctaShadow,
                    ...animStyle(style.animation, style.durationMs, 300, slidePx),
                }}
            >
                {renderHighlightedMotionText(content.cta, theme, 'cta')}
            </div>
        ) : null;

    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden', color: theme.textPrimary }}>
            <Keyframes slidePx={slidePx} />
            <CoverStack imageUrl={content.imageUrl} imageOpacity={imageOpacity} gradient={gradient} vignette={vignette} imgPos={imgPos} theme={theme} />
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    height: '100%',
                    display: 'flex',
                    alignItems: vert ? 'flex-end' : 'center',
                    justifyContent: 'center',
                    padding: land ? `${pad} ${pad}` : pad,
                    boxSizing: 'border-box',
                }}
            >
                <div style={column}>
                    {badge}
                    {titleEl}
                    {copy}
                    {cta}
                </div>
            </div>
        </div>
    );
}

/** 3) Split: solid text slab vs photo side (or top/bottom on 9:16). */
export function OfferSplitPromo({ content, style, previewAspect, previewDesign }: SpecialOfferTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const pad = 'clamp(12px, 3.5cqi, 18px)';
    const a = previewAspect || 'square';
    const vert = a === 'vertical';
    const land = a === 'landscape';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.85);
    const slidePx = 14;
    const lines = motionHeroTitleLines(content.title);
    const ctaBase = motionCtaButtonStyle(theme);
    const ctaLbl = motionCtaLabelContrastStyle(theme);
    const ctaShadow = motionThemeCtaLayeredShadow(theme, ctaBase.boxShadow, undefined);

    const textPanel = (
        <div
            style={{
                background: hexToRgba(theme.bgPrimary, 0.96),
                color: theme.textPrimary,
                padding: pad,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 0,
                border: motionThemeOutlineBorder(theme),
                boxShadow: vert ? '0 -8px 32px rgba(0,0,0,0.35)' : 'none',
            }}
        >
            <div
                style={{
                    fontSize: 'clamp(9px, 2.4cqi, 11px)',
                    fontWeight: 800,
                    letterSpacing: 0.1,
                    textTransform: 'uppercase',
                    color: theme.textAccent,
                    ...animStyle(style.animation, style.durationMs, 0, slidePx),
                }}
            >
                {content.badgeText?.trim() || 'Promo'}
            </div>
            <div className="motion-title" style={{ fontSize: vert ? 'clamp(20px, 6cqi, 30px)' : land ? 'clamp(18px, 5cqi, 26px)' : 'clamp(19px, 5.4cqi, 28px)', fontWeight: 900, lineHeight: 1.12, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 70, slidePx) }}>
                {renderHighlightedMotionText(lines.hero || content.title, theme, 'title')}
            </div>
            {lines.intro ? (
                <div className="motion-title" style={{ fontSize: 'clamp(12px, 3cqi, 15px)', fontWeight: 700, color: muted, ...animStyle(style.animation, style.durationMs, 100, slidePx) }}>
                    {renderHighlightedMotionText(lines.intro, theme, 'title')}
                </div>
            ) : null}
            {content.subtitle ? (
                <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(11px, 2.8cqi, 13px)', ...animStyle(style.animation, style.durationMs, 150, slidePx) }}>
                    {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                </p>
            ) : null}
            {content.description ? (
                <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: vert ? 3 : 2, margin: 0, color: muted, fontSize: 'clamp(10px, 2.5cqi, 12px)', ...animStyle(style.animation, style.durationMs, 190, slidePx) }}>
                    {renderHighlightedMotionText(content.description, theme, 'body')}
                </p>
            ) : null}
            {content.cta ? (
                <div
                    className="motion-button"
                    role="presentation"
                    style={{
                        ...ctaBase,
                        marginTop: 'auto',
                        textAlign: 'center',
                        background: motionThemeCtaGradient(theme),
                        color: ctaLbl.color,
                        textShadow: ctaLbl.textShadow,
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontWeight: 850,
                        fontSize: 'clamp(12px, 3cqi, 15px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: ctaShadow,
                        ...animStyle(style.animation, style.durationMs, 260, slidePx),
                    }}
                >
                    {renderHighlightedMotionText(content.cta, theme, 'cta')}
                </div>
            ) : null}
        </div>
    );

    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;

    const photoOnly = (
        <div style={{ position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            {content.imageUrl ? (
                <img src={content.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: imgPos, opacity: imageOpacity, display: 'block' }} />
            ) : (
                <div style={{ width: '100%', height: '100%', minHeight: 120, background: motionThemeCanvasBackground(theme) }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: gradient, pointerEvents: 'none' }} />
            {vignette ? <div style={{ position: 'absolute', inset: 0, background: vignette, pointerEvents: 'none' }} /> : null}
        </div>
    );

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden' }}>
            <Keyframes slidePx={slidePx} />
            {vert ? (
                <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: '1 1 42%', minHeight: 0 }}>{photoOnly}</div>
                    <div style={{ flex: '0 0 auto', maxHeight: '58%' }}>{textPanel}</div>
                </div>
            ) : land ? (
                <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 44%) minmax(0, 56%)' }}>
                    <div style={{ minHeight: 0 }}>{textPanel}</div>
                    <div style={{ minHeight: 0 }}>{photoOnly}</div>
                </div>
            ) : (
                <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 52%) minmax(0, 48%)' }}>
                    <div style={{ minHeight: 0 }}>{textPanel}</div>
                    <div style={{ minHeight: 0 }}>{photoOnly}</div>
                </div>
            )}
        </div>
    );
}

/** 4) Coupon / voucher card — dashed frame, tear strip, CTA inside card. */
export function OfferCouponStyle({ content, style, previewAspect, previewDesign }: SpecialOfferTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const a = previewAspect || 'square';
    const vert = a === 'vertical';
    const land = a === 'landscape';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.bgPrimary, 0.75);
    const slidePx = 12;
    const lines = motionHeroTitleLines(content.title);
    const ctaBase = motionCtaButtonStyle(theme);
    const ctaLbl = motionCtaLabelContrastStyle(theme);
    const ctaShadow = motionThemeCtaLayeredShadow(theme, ctaBase.boxShadow, undefined);
    const dash = hexToRgba(theme.bgPrimary, 0.55);

    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;
    const cardW = vert ? 'min(94%, 300px)' : land ? 'min(94%, 480px)' : 'min(92%, 340px)';

    const perforation = (
        <div
            style={{
                height: 14,
                margin: '4px -12px',
                background: `radial-gradient(circle, ${dash} 2px, transparent 2.5px) 0 50% / 14px 14px repeat-x`,
                opacity: 0.85,
            }}
            aria-hidden
        />
    );

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden', color: theme.bgPrimary }}>
            <Keyframes slidePx={slidePx} />
            <CoverStack imageUrl={content.imageUrl} imageOpacity={imageOpacity} gradient={gradient} vignette={vignette} imgPos={imgPos} theme={theme} />
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: vert ? '10px 12px' : land ? '10px 14px' : '12px 14px',
                    boxSizing: 'border-box',
                }}
            >
                <div
                    style={{
                        width: cardW,
                        maxHeight: vert ? '92%' : '90%',
                        overflow: 'auto',
                        background: '#fafafa',
                        borderRadius: 8,
                        border: `2px dashed ${hexToRgba(theme.bgPrimary, 0.45)}`,
                        boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
                        padding: vert ? '12px 14px 14px' : '14px 16px 16px',
                        display: 'grid',
                        gap: vert ? 8 : 10,
                        boxSizing: 'border-box',
                        ...animStyle(style.animation, style.durationMs, 0, slidePx),
                    }}
                >
                    <div style={{ fontSize: 'clamp(9px, 2.3cqi, 11px)', fontWeight: 900, letterSpacing: 0.12, textTransform: 'uppercase', color: theme.bgSecondary }}>
                        {content.badgeText?.trim() || 'Voucher'}
                    </div>
                    <div className="motion-title" style={{ fontSize: land ? 'clamp(15px, 4cqi, 20px)' : 'clamp(16px, 4.2cqi, 22px)', fontWeight: 850, lineHeight: 1.15, color: theme.bgPrimary }}>
                        {renderHighlightedMotionText(lines.hero || content.title, theme, 'title')}
                    </div>
                    {content.subtitle ? (
                        <p className="motion-body" style={{ margin: 0, fontSize: 'clamp(11px, 2.8cqi, 13px)', color: muted, lineHeight: 1.35 }}>
                            {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                        </p>
                    ) : null}
                    {perforation}
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center' }}>
                        <div className="motion-title" style={{ fontSize: vert ? 'clamp(28px, 9cqi, 48px)' : land ? 'clamp(26px, 8cqi, 44px)' : 'clamp(30px, 8.5cqi, 50px)', fontWeight: 950, color: theme.bgSecondary, lineHeight: 1, textShadow: 'none' }}>
                            {renderHighlightedMotionText(
                                lines.intro || lines.outro || (content.title || 'SAVE').trim().split(/\s+/)[0] || 'SAVE',
                                theme,
                                'title',
                            )}
                        </div>
                        {lines.outro ? (
                            <div className="motion-title" style={{ fontSize: 'clamp(13px, 3.2cqi, 17px)', fontWeight: 800, color: theme.bgPrimary }}>
                                {renderHighlightedMotionText(lines.outro, theme, 'title')}
                            </div>
                        ) : null}
                        {content.description ? (
                            <p className="motion-body" style={{ margin: 0, fontSize: 'clamp(10px, 2.5cqi, 12px)', color: muted, maxWidth: '100%' }}>
                                {renderHighlightedMotionText(content.description, theme, 'body')}
                            </p>
                        ) : null}
                        {content.cta ? (
                            <div
                                className="motion-button"
                                role="presentation"
                                style={{
                                    ...ctaBase,
                                    width: '100%',
                                    maxWidth: 280,
                                    textAlign: 'center',
                                    background: motionThemeCtaGradient(theme),
                                    color: ctaLbl.color,
                                    textShadow: ctaLbl.textShadow,
                                    borderRadius: 8,
                                    padding: '11px 18px',
                                    fontWeight: 900,
                                    fontSize: 'clamp(12px, 3cqi, 15px)',
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    boxShadow: ctaShadow,
                                    marginTop: 4,
                                }}
                            >
                                {renderHighlightedMotionText(content.cta, theme, 'cta')}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** 5) Flash sale — bold bands, accent energy, loud CTA. */
export function OfferFlashSale({ content, style, previewAspect, previewDesign }: SpecialOfferTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(360);
    const a = previewAspect || 'square';
    const vert = a === 'vertical';
    const land = a === 'landscape';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.9);
    const slidePx = 18;
    const lines = motionHeroTitleLines(content.title);
    const ctaBase = motionCtaButtonStyle(theme);
    const accentBar = theme.textAccent;

    const stripeBg = `repeating-linear-gradient(-28deg, ${hexToRgba(accentBar, 0.22)} 0 18px, transparent 18px 36px)`;

    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden', color: theme.textPrimary }}>
            <Keyframes slidePx={slidePx} />
            <CoverStack imageUrl={content.imageUrl} imageOpacity={imageOpacity} gradient={gradient} vignette={vignette} imgPos={imgPos} theme={theme} />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    background: stripeBg,
                    pointerEvents: 'none',
                    opacity: 0.55,
                }}
            />
            <div
                style={{
                    position: 'relative',
                    zIndex: 3,
                    height: '100%',
                    padding: pad,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: land ? 6 : vert ? 10 : 8,
                }}
            >
                <div
                    style={{
                        alignSelf: 'flex-start',
                        transform: 'skewX(-8deg)',
                        background: accentBar,
                        color: theme.bgPrimary,
                        fontWeight: 950,
                        fontSize: 'clamp(11px, 3cqi, 14px)',
                        letterSpacing: 0.14,
                        padding: '8px 18px',
                        textTransform: 'uppercase',
                        boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
                        ...animStyle(style.animation, style.durationMs, 0, slidePx),
                    }}
                >
                    {content.badgeText?.trim() || 'Flash sale'}
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: land ? 4 : 8 }}>
                    <div
                        className="motion-title"
                        style={{
                            fontSize: vert ? 'clamp(26px, 8cqi, 44px)' : land ? 'clamp(22px, 6.5cqi, 36px)' : 'clamp(24px, 7.2cqi, 40px)',
                            fontWeight: 950,
                            lineHeight: 1.05,
                            textTransform: 'uppercase',
                            textShadow: textBlockShadow,
                            ...animStyle(style.animation, style.durationMs, 80, slidePx),
                        }}
                    >
                        {renderHighlightedMotionText(lines.hero || content.title, theme, 'title')}
                    </div>
                    {lines.intro ? (
                        <div className="motion-title" style={{ fontSize: 'clamp(14px, 3.6cqi, 20px)', fontWeight: 900, color: accentBar, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 120, slidePx) }}>
                            {renderHighlightedMotionText(lines.intro, theme, 'title')}
                        </div>
                    ) : null}
                    {content.subtitle || content.description ? (
                        <div
                            style={{
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: 'rgba(0,0,0,0.35)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                ...animStyle(style.animation, style.durationMs, 180, slidePx),
                            }}
                        >
                            {content.subtitle ? (
                                <p className="motion-body" style={{ margin: 0, fontSize: 'clamp(11px, 2.8cqi, 14px)', fontWeight: 700, color: muted }}>
                                    {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                                </p>
                            ) : null}
                            {content.description ? (
                                <p className="motion-body" style={{ margin: content.subtitle ? 6 : 0, fontSize: 'clamp(10px, 2.5cqi, 12px)', color: muted }}>
                                    {renderHighlightedMotionText(content.description, theme, 'body')}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                {content.cta ? (
                    <div
                        className="motion-button"
                        role="presentation"
                        style={{
                            ...ctaBase,
                            alignSelf: 'stretch',
                            textAlign: 'center',
                            background: accentBar,
                            color: theme.bgPrimary,
                            textShadow: '0 1px 0 rgba(255,255,255,0.25)',
                            borderRadius: 4,
                            padding: land ? '11px 16px' : '14px 18px',
                            fontWeight: 950,
                            fontSize: 'clamp(13px, 3.6cqi, 18px)',
                            letterSpacing: 0.06,
                            textTransform: 'uppercase',
                            border: `3px solid ${hexToRgba(theme.textPrimary, 0.35)}`,
                            boxShadow: `0 10px 0 ${hexToRgba(theme.bgPrimary, 0.35)}, 0 14px 28px rgba(0,0,0,0.45)`,
                            ...animStyle(style.animation, style.durationMs, 260, slidePx),
                        }}
                    >
                        {renderHighlightedMotionText(content.cta, theme, 'cta')}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function SpecialOfferTemplateView(props: SpecialOfferTemplateProps & { templateId: string }) {
    switch (props.templateId) {
        case 'discount_hero':
            return <OfferDiscountHero {...props} />;
        case 'premium_offer':
            return <OfferPremium {...props} />;
        case 'split_promo':
            return <OfferSplitPromo {...props} />;
        case 'coupon_style':
            return <OfferCouponStyle {...props} />;
        case 'flash_sale':
            return <OfferFlashSale {...props} />;
        default:
            return <OfferDiscountHero {...props} />;
    }
}