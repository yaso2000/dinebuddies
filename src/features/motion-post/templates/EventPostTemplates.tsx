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
    motionDescriptionClamp,
    motionDetailsCardBodyTight,
    motionHeroTitleLines,
    motionImageObjectPosition,
    motionReadabilityMuted,
    motionSubtitleClamp,
    motionThemeCtaGradient,
    motionThemeCtaLayeredShadow,
    renderHighlightedMotionText,
    useCoverLuminance,
    useMotionCardWidth,
    type MotionPreviewAspect,
    type MotionPreviewDesign,
} from './motionTemplateShared';

export type EventTemplateProps = {
    content: {
        title: string;
        subtitle?: string;
        description?: string;
        cta?: string;
        dateText?: string;
        timeText?: string;
        locationText?: string;
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

const slideName = (px: number) => `mpEv2Slide_${Math.round(Math.max(3, px))}`;

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
    if (animation === 'fade') return { opacity: 0, animation: `mpEv2FadeIn ${base}`, ...d };
    if (animation === 'slide') return { opacity: 0, transform: `translateY(${y}px)`, animation: `${sk} ${base}`, ...d };
    if (animation === 'pop') return { opacity: 0, transform: 'scale(0.94)', animation: `mpEv2PopIn ${base}`, ...d };
    if (animation === 'zoom') return { opacity: 0, transform: 'scale(0.55)', animation: `mpEv2ZoomIn ${base}`, ...d };
    return { opacity: 0, transform: `translateY(${Math.round(y * 0.65)}px)`, animation: `${sk} ${base}`, ...d };
}

function Keyframes({ slidePx }: { slidePx: number }) {
    const sk = slideName(slidePx);
    return (
        <style>{`
            @keyframes mpEv2FadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes mpEv2PopIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
            @keyframes mpEv2ZoomIn { from { opacity: 0; transform: scale(0.55); } to { opacity: 1; transform: scale(1); } }
            @keyframes ${sk} { from { opacity: 0; transform: translateY(${slidePx}px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    );
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
                <div style={{ position: 'absolute', inset: 0, background: motionThemeCanvasBackground(theme) }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: gradient, pointerEvents: 'none', zIndex: 1 }} />
            {vignette ? (
                <div style={{ position: 'absolute', inset: 0, background: vignette, pointerEvents: 'none', zIndex: 1 }} />
            ) : null}
        </>
    );
}

function MetaBlock({
    dateText,
    timeText,
    locationText,
    theme,
    muted,
    textBlockShadow,
    style,
    compact,
}: {
    dateText?: string;
    timeText?: string;
    locationText?: string;
    theme: (typeof MOTION_THEMES)[MotionThemeId];
    muted: string;
    textBlockShadow?: string;
    style: { animation: MotionAnimation; durationMs: number; slidePx: number; baseDelay: number };
    compact?: boolean;
}) {
    const rows: Array<{ t: string; v: string }> = [];
    if (dateText?.trim()) rows.push({ t: 'date', v: dateText.trim() });
    if (timeText?.trim()) rows.push({ t: 'time', v: timeText.trim() });
    if (locationText?.trim()) rows.push({ t: 'loc', v: locationText.trim() });
    if (!rows.length) return null;
    return (
        <div
            style={{
                display: 'grid',
                gap: compact ? 4 : 6,
                justifyItems: 'stretch',
                textAlign: 'center',
            }}
        >
            {rows.map((row, i) => (
                <div
                    key={row.t}
                    className="motion-body"
                    style={{
                        fontSize: compact ? 'clamp(10px, 2.6cqi, 12px)' : 'clamp(11px, 2.9cqi, 14px)',
                        fontWeight: row.t === 'time' ? 800 : 650,
                        color: row.t === 'time' ? theme.textAccent : muted,
                        lineHeight: 1.35,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        textShadow: textBlockShadow,
                        ...animStyle(style.animation, style.durationMs, style.baseDelay + 80 + i * 45, style.slidePx),
                    }}
                >
                    {renderHighlightedMotionText(row.v, theme, 'body')}
                </div>
            ))}
        </div>
    );
}

function CtaBlock({
    cta,
    theme,
    animation,
    durationMs,
    slidePx,
    delay,
    fullWidth,
}: {
    cta?: string;
    theme: (typeof MOTION_THEMES)[MotionThemeId];
    animation: MotionAnimation;
    durationMs: number;
    slidePx: number;
    delay: number;
    fullWidth?: boolean;
}) {
    if (!cta?.trim()) return null;
    const ctaBase = motionCtaButtonStyle(theme);
    const ctaLbl = motionCtaLabelContrastStyle(theme);
    const ctaShadow = motionThemeCtaLayeredShadow(theme, ctaBase.boxShadow, undefined);
    return (
        <div
            className="motion-button"
            role="presentation"
            style={{
                ...ctaBase,
                width: fullWidth ? '100%' : 'auto',
                textAlign: 'center',
                background: motionThemeCtaGradient(theme),
                color: ctaLbl.color,
                textShadow: ctaLbl.textShadow,
                borderRadius: 12,
                padding: '11px 20px',
                fontWeight: 850,
                fontSize: 'clamp(12px, 3cqi, 15px)',
                border: '1px solid rgba(255,255,255,0.22)',
                boxShadow: ctaShadow,
                justifySelf: fullWidth ? 'stretch' : 'center',
                ...animStyle(animation, durationMs, delay, slidePx),
            }}
        >
            {renderHighlightedMotionText(cta.trim(), theme, 'cta')}
        </div>
    );
}

/** 1) Centered invitation, soft glass panel, meta stack, optional CTA. */
export function EventElegantInvitation({ content, style, previewAspect, previewDesign }: EventTemplateProps) {
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
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.82);
    const slidePx = 12;
    const lines = motionHeroTitleLines(content.title);
    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;
    const panelW = land ? 'min(94%, 520px)' : vert ? 'min(94%, 300px)' : 'min(92%, 360px)';

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
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: pad,
                    boxSizing: 'border-box',
                }}
            >
                <div
                    style={{
                        width: panelW,
                        maxHeight: vert ? '88%' : '90%',
                        overflow: 'auto',
                        padding: vert ? '14px 16px' : land ? '14px 18px' : '18px 20px',
                        borderRadius: 16,
                        background: hexToRgba(theme.bgPrimary, 0.52),
                        border: motionThemeOutlineBorder(theme),
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                        display: 'grid',
                        gap: land ? 8 : 10,
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }}
                >
                    <div className="motion-title" style={{ fontSize: land ? 'clamp(17px, 4.8cqi, 26px)' : 'clamp(19px, 5.4cqi, 30px)', fontWeight: 750, lineHeight: 1.2, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 0, slidePx) }}>
                        {renderHighlightedMotionText(lines.hero || content.title, theme, 'title')}
                    </div>
                    {lines.intro ? (
                        <div className="motion-title" style={{ fontSize: 'clamp(12px, 3cqi, 15px)', fontWeight: 650, color: muted, ...animStyle(style.animation, style.durationMs, 50, slidePx) }}>
                            {renderHighlightedMotionText(lines.intro, theme, 'title')}
                        </div>
                    ) : null}
                    {content.subtitle ? (
                        <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(11px, 2.8cqi, 13px)', textShadow: previewDesign != null ? textBlockShadow : undefined, ...animStyle(style.animation, style.durationMs, 100, slidePx) }}>
                            {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                        </p>
                    ) : null}
                    <MetaBlock
                        dateText={content.dateText}
                        timeText={content.timeText}
                        locationText={content.locationText}
                        theme={theme}
                        muted={muted}
                        textBlockShadow={textBlockShadow}
                        style={{ animation: style.animation, durationMs: style.durationMs, slidePx, baseDelay: 120 }}
                    />
                    {content.description ? (
                        <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: vert ? 3 : 2, margin: 0, color: muted, fontSize: 'clamp(10px, 2.5cqi, 12px)', ...animStyle(style.animation, style.durationMs, 200, slidePx) }}>
                            {renderHighlightedMotionText(content.description, theme, 'body')}
                        </p>
                    ) : null}
                    <CtaBlock cta={content.cta} theme={theme} animation={style.animation} durationMs={style.durationMs} slidePx={slidePx} delay={280} fullWidth />
                </div>
            </div>
        </div>
    );
}

/** 2) Nightlife — accent rail, bold type, date/time emphasized. */
export function EventPartyNight({ content, style, previewAspect, previewDesign }: EventTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(380);
    const a = previewAspect || 'square';
    const land = a === 'landscape';
    const vert = a === 'vertical';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.88);
    const slidePx = 16;
    const accent = theme.textAccent;
    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;

    const dtRow = (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: land ? '1fr 1fr' : '1fr',
                gap: 8,
                ...animStyle(style.animation, style.durationMs, 120, slidePx),
            }}
        >
            {content.dateText?.trim() ? (
                <div
                    className="motion-title"
                    style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: hexToRgba(accent, 0.22),
                        border: `1px solid ${hexToRgba(accent, 0.45)}`,
                        fontWeight: 900,
                        fontSize: 'clamp(12px, 3.2cqi, 16px)',
                        color: theme.textPrimary,
                        textAlign: 'center',
                        textShadow: textBlockShadow,
                        wordBreak: 'break-word',
                    }}
                >
                    {renderHighlightedMotionText(content.dateText, theme, 'title')}
                </div>
            ) : null}
            {content.timeText?.trim() ? (
                <div
                    className="motion-title"
                    style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: hexToRgba(theme.bgSecondary, 0.55),
                        border: `1px solid ${hexToRgba(accent, 0.5)}`,
                        fontWeight: 950,
                        fontSize: 'clamp(13px, 3.6cqi, 18px)',
                        color: accent,
                        textAlign: 'center',
                        boxShadow: `0 0 24px ${hexToRgba(accent, 0.25)}`,
                        wordBreak: 'break-word',
                    }}
                >
                    {renderHighlightedMotionText(content.timeText, theme, 'title')}
                </div>
            ) : null}
        </div>
    );

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden', color: theme.textPrimary }}>
            <Keyframes slidePx={slidePx} />
            <CoverStack imageUrl={content.imageUrl} imageOpacity={imageOpacity} gradient={gradient} vignette={vignette} imgPos={imgPos} theme={theme} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: accent, zIndex: 2, boxShadow: `0 0 20px ${hexToRgba(accent, 0.5)}` }} />
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    height: '100%',
                    padding: pad,
                    paddingTop: `calc(${pad} + 8px)`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: vert ? 10 : 8,
                }}
            >
                <div className="motion-title" style={{ fontSize: vert ? 'clamp(22px, 6.5cqi, 34px)' : land ? 'clamp(20px, 5.8cqi, 30px)' : 'clamp(22px, 6.2cqi, 32px)', fontWeight: 950, lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: 0.04, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 0, slidePx) }}>
                    {renderHighlightedMotionText(content.title, theme, 'title')}
                </div>
                {content.subtitle ? (
                    <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(11px, 2.9cqi, 14px)', fontWeight: 700, ...animStyle(style.animation, style.durationMs, 70, slidePx) }}>
                        {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                    </p>
                ) : null}
                {dtRow}
                {content.locationText?.trim() ? (
                    <div className="motion-body" style={{ fontSize: 'clamp(11px, 2.8cqi, 13px)', color: muted, textAlign: 'center', wordBreak: 'break-word', ...animStyle(style.animation, style.durationMs, 180, slidePx) }}>
                        {renderHighlightedMotionText(content.locationText, theme, 'body')}
                    </div>
                ) : null}
                {content.description ? (
                    <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(10px, 2.5cqi, 12px)', flex: land ? 1 : undefined, minHeight: 0, ...animStyle(style.animation, style.durationMs, 220, slidePx) }}>
                        {renderHighlightedMotionText(content.description, theme, 'body')}
                    </p>
                ) : null}
                <div style={{ marginTop: 'auto' }}>
                    <CtaBlock cta={content.cta} theme={theme} animation={style.animation} durationMs={style.durationMs} slidePx={slidePx} delay={300} fullWidth />
                </div>
            </div>
        </div>
    );
}

/** 3) Birthday — playful rounded blocks, festive dots overlay. */
export function EventBirthdayCelebration({ content, style, previewAspect, previewDesign }: EventTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(380);
    const a = previewAspect || 'square';
    const land = a === 'landscape';
    const vert = a === 'vertical';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.85);
    const slidePx = 14;
    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;
    const dots = `radial-gradient(circle at 12% 18%, ${hexToRgba(theme.textAccent, 0.35)} 0, transparent 12%), radial-gradient(circle at 88% 22%, ${hexToRgba(theme.bgSecondary, 0.4)} 0, transparent 14%), radial-gradient(circle at 40% 90%, ${hexToRgba(theme.textAccent, 0.28)} 0, transparent 10%)`;

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden', color: theme.textPrimary }}>
            <Keyframes slidePx={slidePx} />
            <CoverStack imageUrl={content.imageUrl} imageOpacity={imageOpacity} gradient={gradient} vignette={vignette} imgPos={imgPos} theme={theme} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: dots, pointerEvents: 'none', opacity: 0.9 }} />
            <div
                style={{
                    position: 'relative',
                    zIndex: 3,
                    height: '100%',
                    padding: pad,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: land ? 8 : 10,
                }}
            >
                <div
                    style={{
                        alignSelf: 'center',
                        padding: '6px 16px',
                        borderRadius: 999,
                        background: hexToRgba(theme.bgSecondary, 0.75),
                        fontWeight: 900,
                        fontSize: 'clamp(10px, 2.6cqi, 12px)',
                        letterSpacing: 0.08,
                        ...animStyle(style.animation, style.durationMs, 0, slidePx),
                    }}
                >
                    {renderHighlightedMotionText(content.dateText?.trim() || '—', theme, 'title')}
                </div>
                <div className="motion-title" style={{ textAlign: 'center', fontSize: vert ? 'clamp(20px, 6cqi, 32px)' : 'clamp(21px, 6.2cqi, 34px)', fontWeight: 900, lineHeight: 1.1, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 60, slidePx) }}>
                    {renderHighlightedMotionText(content.title, theme, 'title')}
                </div>
                {content.subtitle ? (
                    <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, textAlign: 'center', color: muted, ...animStyle(style.animation, style.durationMs, 110, slidePx) }}>
                        {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                    </p>
                ) : null}
                <div
                    style={{
                        padding: '10px 12px',
                        borderRadius: 18,
                        background: hexToRgba(theme.bgPrimary, 0.55),
                        border: `2px dashed ${hexToRgba(theme.textAccent, 0.45)}`,
                        display: 'grid',
                        gap: 6,
                        textAlign: 'center',
                        ...animStyle(style.animation, style.durationMs, 150, slidePx),
                    }}
                >
                    {content.timeText?.trim() ? (
                        <div className="motion-title" style={{ fontSize: 'clamp(14px, 3.8cqi, 20px)', fontWeight: 900, color: theme.textAccent }}>
                            {renderHighlightedMotionText(content.timeText, theme, 'title')}
                        </div>
                    ) : null}
                    <MetaBlock dateText={undefined} timeText={undefined} locationText={content.locationText} theme={theme} muted={muted} textBlockShadow={textBlockShadow} style={{ animation: style.animation, durationMs: style.durationMs, slidePx, baseDelay: 0 }} compact />
                </div>
                {content.description ? (
                    <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: vert ? 3 : 2, margin: 0, textAlign: 'center', color: muted, fontSize: 'clamp(10px, 2.5cqi, 12px)', ...animStyle(style.animation, style.durationMs, 200, slidePx) }}>
                        {renderHighlightedMotionText(content.description, theme, 'body')}
                    </p>
                ) : null}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}>
                    <CtaBlock cta={content.cta} theme={theme} animation={style.animation} durationMs={style.durationMs} slidePx={slidePx} delay={260} />
                </div>
            </div>
        </div>
    );
}

/** 4) Business — editorial left stack, minimal chrome. */
export function EventBusinessEvent({ content, style, previewAspect, previewDesign }: EventTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(400);
    const a = previewAspect || 'square';
    const land = a === 'landscape';
    const vert = a === 'vertical';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.78);
    const slidePx = 10;
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
                    padding: pad,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: land ? 'row' : 'column',
                    gap: land ? 16 : 10,
                    alignItems: land ? 'stretch' : 'stretch',
                }}
            >
                <div
                    style={{
                        flex: land ? '0 0 52%' : 1,
                        minWidth: 0,
                        borderLeft: land ? `4px solid ${theme.bgSecondary}` : 'none',
                        borderTop: land ? 'none' : `4px solid ${theme.bgSecondary}`,
                        paddingLeft: land ? 12 : 0,
                        paddingTop: land ? 0 : 8,
                        display: 'grid',
                        gap: 8,
                        alignContent: 'start',
                    }}
                >
                    <div className="motion-title" style={{ fontSize: land ? 'clamp(16px, 4.2cqi, 22px)' : 'clamp(17px, 4.6cqi, 24px)', fontWeight: 750, lineHeight: 1.2, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 0, slidePx) }}>
                        {renderHighlightedMotionText(content.title, theme, 'title')}
                    </div>
                    {content.subtitle ? (
                        <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(11px, 2.7cqi, 13px)', ...animStyle(style.animation, style.durationMs, 60, slidePx) }}>
                            {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                        </p>
                    ) : null}
                    <div style={{ display: 'grid', gap: 4, fontSize: 'clamp(10px, 2.5cqi, 12px)', color: muted, ...animStyle(style.animation, style.durationMs, 100, slidePx) }}>
                        {content.dateText?.trim() ? <div style={{ fontWeight: 700 }}>{renderHighlightedMotionText(content.dateText, theme, 'body')}</div> : null}
                        {content.timeText?.trim() ? <div style={{ fontWeight: 700, color: theme.textPrimary }}>{renderHighlightedMotionText(content.timeText, theme, 'body')}</div> : null}
                        {content.locationText?.trim() ? <div style={{ wordBreak: 'break-word' }}>{renderHighlightedMotionText(content.locationText, theme, 'body')}</div> : null}
                    </div>
                    {content.description ? (
                        <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: land ? 4 : 3, margin: 0, color: muted, lineHeight: 1.45, ...animStyle(style.animation, style.durationMs, 140, slidePx) }}>
                            {renderHighlightedMotionText(content.description, theme, 'body')}
                        </p>
                    ) : null}
                </div>
                {land ? (
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <CtaBlock cta={content.cta} theme={theme} animation={style.animation} durationMs={style.durationMs} slidePx={slidePx} delay={200} />
                    </div>
                ) : (
                    <div style={{ marginTop: 'auto' }}>
                        <CtaBlock cta={content.cta} theme={theme} animation={style.animation} durationMs={style.durationMs} slidePx={slidePx} delay={200} fullWidth />
                    </div>
                )}
            </div>
        </div>
    );
}

/** 5) Romantic dinner — warm gradient veil, soft type. */
export function EventRomanticDinner({ content, style, previewAspect, previewDesign }: EventTemplateProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(380);
    const a = previewAspect || 'square';
    const land = a === 'landscape';
    const vert = a === 'vertical';
    const muted = previewDesign != null ? motionReadabilityMuted(theme, overlayWeight) : hexToRgba(theme.textPrimary, 0.8);
    const slidePx = 12;
    const frame = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;
    const warm = `linear-gradient(165deg, ${hexToRgba('#4a1d2e', 0.35)} 0%, ${hexToRgba(theme.bgPrimary, 0.42)} 55%, ${hexToRgba('#1a0a10', 0.55)} 100%)`;

    return (
        <div ref={rootRef} style={{ ...frame, border: motionThemeOutlineBorder(theme), position: 'relative', overflow: 'hidden', color: theme.textPrimary }}>
            <Keyframes slidePx={slidePx} />
            <CoverStack imageUrl={content.imageUrl} imageOpacity={imageOpacity} gradient={gradient} vignette={vignette} imgPos={imgPos} theme={theme} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: warm, pointerEvents: 'none' }} />
            <div
                style={{
                    position: 'relative',
                    zIndex: 3,
                    height: '100%',
                    padding: pad,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: vert ? 'flex-end' : 'center',
                    gap: 10,
                    textAlign: 'center',
                }}
            >
                <div className="motion-title" style={{ fontSize: land ? 'clamp(18px, 5cqi, 26px)' : vert ? 'clamp(20px, 5.8cqi, 30px)' : 'clamp(19px, 5.4cqi, 28px)', fontWeight: 680, letterSpacing: 0.04, lineHeight: 1.25, textShadow: textBlockShadow, ...animStyle(style.animation, style.durationMs, 0, slidePx) }}>
                    {renderHighlightedMotionText(content.title, theme, 'title')}
                </div>
                {content.subtitle ? (
                    <p className="motion-body" style={{ ...motionSubtitleClamp, WebkitLineClamp: 2, margin: 0, color: muted, fontSize: 'clamp(11px, 2.8cqi, 14px)', fontStyle: 'italic', ...animStyle(style.animation, style.durationMs, 70, slidePx) }}>
                        {renderHighlightedMotionText(content.subtitle, theme, 'body')}
                    </p>
                ) : null}
                <MetaBlock dateText={content.dateText} timeText={content.timeText} locationText={content.locationText} theme={theme} muted={muted} textBlockShadow={textBlockShadow} style={{ animation: style.animation, durationMs: style.durationMs, slidePx, baseDelay: 100 }} />
                {content.description ? (
                    <p className="motion-body" style={{ ...motionDescriptionClamp, WebkitLineClamp: 3, margin: 0, color: muted, fontSize: 'clamp(10px, 2.5cqi, 12px)', ...animStyle(style.animation, style.durationMs, 180, slidePx) }}>
                        {renderHighlightedMotionText(content.description, theme, 'body')}
                    </p>
                ) : null}
                <div style={{ marginTop: vert ? 8 : 12 }}>
                    <CtaBlock cta={content.cta} theme={theme} animation={style.animation} durationMs={style.durationMs} slidePx={slidePx} delay={260} fullWidth />
                </div>
            </div>
        </div>
    );
}

export function EventTemplateView(props: EventTemplateProps & { templateId: string }) {
    switch (props.templateId) {
        case 'elegant_invitation':
            return <EventElegantInvitation {...props} />;
        case 'party_night':
            return <EventPartyNight {...props} />;
        case 'birthday_celebration':
            return <EventBirthdayCelebration {...props} />;
        case 'business_event':
            return <EventBusinessEvent {...props} />;
        case 'romantic_dinner':
            return <EventRomanticDinner {...props} />;
        default:
            return <EventElegantInvitation {...props} />;
    }
}