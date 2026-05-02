import React, { useEffect } from 'react';
import { MOTION_THEMES, hexToRgba, motionThemeCanvasBackground, motionThemeOutlineBorder, type MotionThemeId } from '../theme/themeTokens';
import type { MotionAnimation } from './registry';
import {
    MOTION_CARD_ROOT_STYLE,
    motionCardRootStyleForPreviewAspect,
    motionContentPadding,
    motionCoverScrim,
    motionHeroTitleLines,
    motionImageObjectPosition,
    motionReadabilityMuted,
    renderHighlightedMotionText,
    motionArtisticArabicTitle,
    useCoverLuminance,
    useMotionCardWidth,
    type MotionPreviewAspect,
    type MotionPreviewDesign,
} from './motionTemplateShared';

type NormalStubProps = {
    content: {
        title: string;
        subtitle?: string;
        description?: string;
        imageUrl?: string;
    };
    style: {
        themeId: MotionThemeId;
        animation: MotionAnimation;
        durationMs: number;
    };
    previewAspect?: MotionPreviewAspect;
    previewDesign?: MotionPreviewDesign | null;
    /** Layout template id (Classic Split, Editorial Luxury, Wide Banner). */
    postTemplateId?: string;
    /** e.g. 1:1, 16:9, 9:16 */
    aspectRatio?: string;
};

type NormalTemplateId = 'classic_split' | 'editorial_luxury' | 'wide_banner' | 'free_hero_center' | 'free_editorial_left';
type UiAspectRatio = '1:1' | '16:9' | '9:16';

const slideYName = (px: number) => `mpNmSlideY_${Math.round(Math.max(3, px))}`;

/** Normal-post text panel: show full subtitle/body (no line-clamp or fade mask). */
const motionSubtitleFull: React.CSSProperties = {
    margin: 0,
    fontSize: 'clamp(12px, 3.4cqi, 15px)',
    fontFamily: "'Tajawal', sans-serif",
    lineHeight: 1.35,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-line',
    overflow: 'visible',
};

const motionDescriptionFull: React.CSSProperties = {
    margin: 0,
    fontSize: 'clamp(12px, 3.1cqi, 14px)',
    fontFamily: "'Tajawal', sans-serif",
    lineHeight: 1.45,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-line',
    overflow: 'visible',
};

const animStyle = (
    animation: MotionAnimation,
    durationMs: number,
    delayMs = 0,
    slidePx = 14,
): React.CSSProperties => {
    const base = `${durationMs}ms ease forwards`;
    const delayed = { animationDelay: `${delayMs}ms` };
    const y = slideYName(slidePx);
    const yv = Math.max(3, slidePx);
    if (animation === 'fade') return { opacity: 0, animation: `mpFadeIn ${base}`, ...delayed };
    if (animation === 'slide') return { opacity: 0, transform: `translateY(${yv}px)`, animation: `${y} ${base}`, ...delayed };
    if (animation === 'pop') return { opacity: 0, transform: 'scale(0.92)', animation: `mpPopIn ${base}`, ...delayed };
    return { opacity: 0, transform: `translateY(${Math.round(yv * 0.65)}px)`, animation: `${y} ${base}`, ...delayed };
};

function normalizeTemplateId(input?: string): NormalTemplateId {
    const v = String(input || '').trim().toLowerCase();
    if (v === 'editorial_luxury') return 'editorial_luxury';
    if (v === 'wide_banner') return 'wide_banner';
    if (v === 'free_hero_center') return 'free_hero_center';
    if (v === 'free_editorial_left') return 'free_editorial_left';
    return 'classic_split';
}

function normalizeAspectRatio(aspectRatio?: string, previewAspect?: MotionPreviewAspect): UiAspectRatio {
    const v = String(aspectRatio || '').trim();
    if (v === '16:9') return '16:9';
    if (v === '9:16') return '9:16';
    if (v === '1:1') return '1:1';
    if (previewAspect === 'landscape') return '16:9';
    if (previewAspect === 'vertical') return '9:16';
    return '1:1';
}

/**
 * Normal (non-offer / non-event) preview: title, subtitle, body, cover, theme.
 * No CTA button, no offer badge. Template + aspect drive visual composition.
 */
export default function SqNormalStubV1({
    content,
    style,
    previewAspect,
    previewDesign,
    postTemplateId,
    aspectRatio,
}: NormalStubProps) {
    const theme = MOTION_THEMES[style.themeId] || MOTION_THEMES.midnight;
    const luma = useCoverLuminance(content.imageUrl);
    const scrim = motionCoverScrim(theme, luma, previewDesign);
    const { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight } = scrim;
    const imgPos = previewDesign != null ? motionImageObjectPosition(previewDesign.imageFocus) : 'center center';
    const [rootRef, cardW] = useMotionCardWidth<HTMLDivElement>();
    const pad = motionContentPadding(cardW);
    const muted = motionReadabilityMuted(theme, overlayWeight);
    const frameStyle = previewAspect ? motionCardRootStyleForPreviewAspect(previewAspect) : MOTION_CARD_ROOT_STYLE;
    const slidePx = 14;
    const skY = slideYName(slidePx);
    const normalizedTemplateId = normalizeTemplateId(postTemplateId);
    const normalizedAspectRatio = normalizeAspectRatio(aspectRatio, previewAspect);

    useEffect(() => {
        console.log('[MotionPost][NormalStub]', {
            templateId: 'normal_post_stub_v1',
            postTemplateId: normalizedTemplateId,
            aspectRatio: normalizedAspectRatio,
        });
    }, [normalizedTemplateId, normalizedAspectRatio]);

    const hasDoubleDoubleQuoteMarkers = String(content.title || '').includes('""');
    const heroLines = hasDoubleDoubleQuoteMarkers
        ? { intro: '', hero: String(content.title || ''), outro: '' }
        : motionHeroTitleLines(content.title);

    const titleBlock = (
        <div
            style={{
                display: 'grid',
                gap: 6,
                textAlign: 'center',
            }}
        >
            {heroLines.intro ? (
                <div
                    className="motion-title"
                    style={{
                        fontSize: 'clamp(12px, 3cqi, 16px)',
                        fontWeight: 700,
                        color: theme.textPrimary,
                        lineHeight: 1.3,
                        textShadow: textBlockShadow,
                        ...animStyle(style.animation, style.durationMs, 60, slidePx),
                    }}
                >
                    {renderHighlightedMotionText(heroLines.intro, theme, 'title', { quotedHighlights: true })}
                </div>
            ) : null}
            <div
                className="motion-title"
                style={{
                    fontSize: 'clamp(22px, 7cqi, 36px)',
                    fontWeight: 900,
                    lineHeight: 1.08,
                    color: theme.textPrimary,
                    textShadow: textBlockShadow,
                    ...animStyle(style.animation, style.durationMs, 120, slidePx),
                }}
            >
                {renderHighlightedMotionText(heroLines.hero || motionArtisticArabicTitle(content.title), theme, 'title', { quotedHighlights: true })}
            </div>
            {heroLines.outro ? (
                <div
                    className="motion-title"
                    style={{
                        fontSize: 'clamp(12px, 3.2cqi, 17px)',
                        fontWeight: 800,
                        color: theme.textPrimary,
                        lineHeight: 1.25,
                        textShadow: textBlockShadow,
                        ...animStyle(style.animation, style.durationMs, 170, slidePx),
                    }}
                >
                    {renderHighlightedMotionText(heroLines.outro, theme, 'title', { quotedHighlights: true })}
                </div>
            ) : null}
        </div>
    );

    const subtitleEl = content.subtitle ? (
        <p
            className="motion-body"
            style={{
                ...motionSubtitleFull,
                color: muted,
                textShadow: textBlockShadow,
                ...animStyle(style.animation, style.durationMs, 220, slidePx),
            }}
        >
            {renderHighlightedMotionText(content.subtitle, theme, 'body', { quotedHighlights: true })}
        </p>
    ) : null;

    const descriptionEl = content.description ? (
        <p
            className="motion-body"
            style={{
                ...motionDescriptionFull,
                color: muted,
                textShadow: textBlockShadow,
                ...animStyle(style.animation, style.durationMs, 290, slidePx),
            }}
        >
            {renderHighlightedMotionText(content.description, theme, 'body', { quotedHighlights: true })}
        </p>
    ) : null;

    const textPanel = (
        <div
            style={{
                borderRadius: 16,
                border: motionThemeOutlineBorder(theme),
                display: 'grid',
                gap: 10,
                boxSizing: 'border-box',
                width: '100%',
                minWidth: 0,
                overflow: 'visible',
                ...animStyle(style.animation, style.durationMs, 0, slidePx),
            }}
        >
            {titleBlock}
            {subtitleEl}
            {descriptionEl}
        </div>
    );

    const renderClassicSplit = () => {
        const splitByAspect: Record<UiAspectRatio, { textBasis: string; imageBasis: string; panelPadding: string }> = {
            '1:1': { textBasis: '53%', imageBasis: '47%', panelPadding: '16px 14px' },
            '16:9': { textBasis: '50%', imageBasis: '50%', panelPadding: '14px 12px' },
            '9:16': { textBasis: '58%', imageBasis: '42%', panelPadding: '16px 14px' },
        };
        const cfg = splitByAspect[normalizedAspectRatio];
        return (
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 0,
                }}
            >
                <div
                    style={{
                        flexBasis: cfg.textBasis,
                        flexGrow: 1,
                        minWidth: 0,
                        padding: pad,
                        display: 'flex',
                        alignItems: 'flex-start',
                        alignSelf: 'stretch',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            padding: cfg.panelPadding,
                            background: `linear-gradient(170deg, ${hexToRgba(theme.bgPrimary, 0.84)} 0%, ${hexToRgba(theme.bgSecondary, 0.72)} 100%)`,
                            boxShadow: '0 12px 34px rgba(0,0,0,0.34)',
                            minWidth: 0,
                            overflow: 'visible',
                        }}
                    >
                        {textPanel}
                    </div>
                </div>
                <div style={{ flexBasis: cfg.imageBasis, flexGrow: 1, minWidth: 0 }} />
            </div>
        );
    };

    const renderEditorialLuxury = () => {
        const cfg: Record<UiAspectRatio, { panelW: string; align: 'flex-start' | 'center'; panelPad: string }> = {
            '1:1': { panelW: '62%', align: 'center', panelPad: pad },
            '16:9': { panelW: '52%', align: 'center', panelPad: 'clamp(10px, 3.2vw, 14px)' },
            '9:16': { panelW: '70%', align: 'flex-start', panelPad: 'clamp(14px, 4.5vw, 20px)' },
        };
        const c = cfg[normalizedAspectRatio];
        return (
            <>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        background: `linear-gradient(110deg, ${hexToRgba(theme.bgPrimary, 0.92)} 0%, ${hexToRgba(theme.bgPrimary, 0.7)} 36%, rgba(0,0,0,0.06) 68%, rgba(0,0,0,0) 100%)`,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        background: `linear-gradient(180deg, ${hexToRgba(theme.bgSecondary, 0.14)} 0%, rgba(0,0,0,0.24) 100%)`,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        padding: c.panelPad,
                        display: 'flex',
                        alignItems: c.align,
                    }}
                >
                    <div
                        style={{
                            width: c.panelW,
                            minWidth: 0,
                            padding: '16px 14px',
                            borderRadius: 18,
                            background: `linear-gradient(180deg, ${hexToRgba(theme.bgPrimary, 0.84)} 0%, ${hexToRgba(theme.bgPrimary, 0.56)} 100%)`,
                            border: `1px solid ${hexToRgba(theme.textAccent, 0.24)}`,
                            boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(1.5px)',
                            overflow: 'visible',
                        }}
                    >
                        {textPanel}
                    </div>
                </div>
            </>
        );
    };

    const renderFreeHeroCenter = () => {
        const cfg: Record<UiAspectRatio, { headingScale: number; blockW: string; bottomPad: string; gap: number }> = {
            '1:1': { headingScale: 1.08, blockW: '88%', bottomPad: 'clamp(16px, 5cqi, 24px)', gap: 10 },
            '16:9': { headingScale: 1.2, blockW: '84%', bottomPad: 'clamp(12px, 3.8cqi, 18px)', gap: 8 },
            '9:16': { headingScale: 1.02, blockW: '92%', bottomPad: 'clamp(18px, 6cqi, 28px)', gap: 11 },
        };
        const c = cfg[normalizedAspectRatio];
        return (
            <>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        background: `linear-gradient(180deg, ${hexToRgba(theme.bgPrimary, 0.22)} 0%, ${hexToRgba(theme.bgSecondary, 0.42)} 48%, rgba(0,0,0,0.72) 100%)`,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        paddingInline: pad,
                        paddingBlock: c.bottomPad,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{ width: c.blockW, display: 'grid', gap: c.gap, justifyItems: 'center' }}>
                        <div style={{ transform: `scale(${c.headingScale})`, transformOrigin: 'center center' }}>{titleBlock}</div>
                        {subtitleEl}
                        {descriptionEl}
                    </div>
                </div>
            </>
        );
    };

    const renderFreeEditorialLeft = () => {
        const cfg: Record<UiAspectRatio, { blockW: string; maxBodyW: string; topPad: string; gap: number }> = {
            '1:1': { blockW: '72%', maxBodyW: '95%', topPad: 'clamp(16px, 5cqi, 24px)', gap: 10 },
            '16:9': { blockW: '58%', maxBodyW: '92%', topPad: 'clamp(12px, 3.5cqi, 18px)', gap: 8 },
            '9:16': { blockW: '86%', maxBodyW: '96%', topPad: 'clamp(18px, 6cqi, 28px)', gap: 11 },
        };
        const c = cfg[normalizedAspectRatio];
        return (
            <>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        background: `linear-gradient(90deg, ${hexToRgba(theme.bgPrimary, 0.88)} 0%, ${hexToRgba(theme.bgSecondary, 0.58)} 42%, rgba(0,0,0,0.16) 76%, rgba(0,0,0,0.04) 100%)`,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        paddingInline: pad,
                        paddingBlock: c.topPad,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{ width: c.blockW, minWidth: 0, display: 'grid', gap: c.gap, textAlign: 'start' }}>
                        <div
                            style={{
                                width: 'min(64px, 22%)',
                                height: 3,
                                borderRadius: 999,
                                background: hexToRgba(theme.textAccent, 0.9),
                                ...animStyle(style.animation, style.durationMs, 40, slidePx),
                            }}
                        />
                        <div
                            style={{
                                fontSize: 'clamp(24px, 7.8cqi, 42px)',
                                fontWeight: 900,
                                lineHeight: 1.08,
                                color: theme.textPrimary,
                                textShadow: textBlockShadow,
                                whiteSpace: 'pre-line',
                                ...animStyle(style.animation, style.durationMs, 110, slidePx),
                            }}
                            className="motion-title"
                        >
                            {renderHighlightedMotionText(motionArtisticArabicTitle(content.title), theme, 'title', { quotedHighlights: true })}
                        </div>
                        {subtitleEl}
                        {descriptionEl ? <div style={{ maxWidth: c.maxBodyW }}>{descriptionEl}</div> : null}
                    </div>
                </div>
            </>
        );
    };

    const renderTemplateLayout = () => {
        try {
            if (normalizedTemplateId === 'editorial_luxury') return renderEditorialLuxury();
            if (normalizedTemplateId === 'wide_banner') return renderWideBanner();
            if (normalizedTemplateId === 'free_hero_center') return renderFreeHeroCenter();
            if (normalizedTemplateId === 'free_editorial_left') return renderFreeEditorialLeft();
            return renderClassicSplit();
        } catch (err) {
            console.error('[MotionPost][NormalStub] template render failed, fallback to classic_split', {
                err,
                postTemplateId: normalizedTemplateId,
                aspectRatio: normalizedAspectRatio,
            });
            return renderClassicSplit();
        }
    };

    const renderWideBanner = () => {
        const cfg: Record<UiAspectRatio, { headingScale: number; panelMinH: string }> = {
            '1:1': { headingScale: 1.08, panelMinH: '44%' },
            '16:9': { headingScale: 1.25, panelMinH: '48%' },
            '9:16': { headingScale: 1, panelMinH: '40%' },
        };
        const c = cfg[normalizedAspectRatio];
        return (
            <>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        background: `linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.62) 100%)`,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: pad,
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            minHeight: c.panelMinH,
                            padding: '14px 14px 12px',
                            borderRadius: 16,
                            background: `linear-gradient(180deg, ${hexToRgba(theme.bgPrimary, 0.38)} 0%, ${hexToRgba(theme.bgPrimary, 0.74)} 36%, ${hexToRgba(theme.bgSecondary, 0.84)} 100%)`,
                            border: motionThemeOutlineBorder(theme),
                            boxShadow: '0 16px 34px rgba(0,0,0,0.42)',
                            display: 'grid',
                            gap: 8,
                            minWidth: 0,
                            overflow: 'visible',
                            ...animStyle(style.animation, style.durationMs, 0, slidePx),
                        }}
                    >
                        <div style={{ transform: `scale(${c.headingScale})`, transformOrigin: 'left center' }}>{titleBlock}</div>
                        {subtitleEl}
                        {descriptionEl ? <div style={{ display: 'grid', minWidth: 0 }}>{descriptionEl}</div> : null}
                    </div>
                </div>
            </>
        );
    };

    return (
        <div
            ref={rootRef}
            style={{
                ...frameStyle,
                border: motionThemeOutlineBorder(theme),
                background: motionThemeCanvasBackground(theme),
                color: theme.textPrimary,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {content.imageUrl ? (
                <>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <img
                        src={content.imageUrl}
                        alt=""
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: imgPos,
                            opacity: imageOpacity,
                            transform: normalizedTemplateId === 'wide_banner' ? 'scale(1.04)' : 'scale(1.02)',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: gradient,
                            pointerEvents: 'none',
                        }}
                    />
                    {vignette ? (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                boxShadow: vignette,
                                pointerEvents: 'none',
                            }}
                        />
                    ) : null}
                </>
            ) : null}

            {renderTemplateLayout()}
            <style>{`
                @keyframes mpFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes mpPopIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
                @keyframes ${skY} { from { opacity: 0; transform: translateY(${Math.max(3, slidePx)}px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}