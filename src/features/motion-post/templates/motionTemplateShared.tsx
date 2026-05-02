import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { hexToRgba, type MotionTheme } from '../theme/themeTokens';
import './motionTypography.css';

/** Sample cover image luminance (0–255). Null if no image or CORS/sample failed. */
export function useCoverLuminance(imageUrl?: string): number | null {
    const [luma, setLuma] = useState<number | null>(null);

    useEffect(() => {
        const url = imageUrl?.trim();
        if (!url) {
            setLuma(null);
            return;
        }

        let cancelled = false;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (cancelled) return;
            try {
                const w = 56;
                const h = 56;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    setLuma(null);
                    return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                const { data } = ctx.getImageData(0, 0, w, h);
                let sum = 0;
                let n = 0;
                for (let i = 0; i < data.length; i += 16) {
                    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    n += 1;
                }
                setLuma(n ? sum / n : null);
            } catch {
                setLuma(null);
            }
        };
        img.onerror = () => {
            if (!cancelled) setLuma(null);
        };
        img.src = url;

        return () => {
            cancelled = true;
        };
    }, [imageUrl]);

    return luma;
}

/** Studio preview only — not persisted to Firestore. */
export type MotionPreviewDesign = {
    textPlacement?: string;
    overlayStrength?: number;
    imageFocus?: string;
    styleMood?: string;
};

export type MotionCoverScrimResult = {
    /** Flat black cover wash — same on every theme (`rgba(0,0,0,α)`), no theme tint. */
    gradient: string;
    imageOpacity: number;
    /** Optional extra layer (absolute, z-index above base gradient). */
    vignette?: string;
    /** Drop shadow for text blocks — scales with overlay strength. */
    textBlockShadow: string;
    /** Normalized overlay weight 0–1 for downstream contrast tweaks. */
    overlayWeight: number;
};

/**
 * Unified **flat black** cover on every theme (ignores theme chroma). Photo stays at full opacity; darkness is only the black scrim.
 * `overlayStrength` + luma tweak scrim alpha; type contrast still uses `textBlockShadow` / `motionReadabilityMuted`.
 */
export function motionCoverScrim(
    _theme: MotionTheme,
    luma: number | null,
    previewDesign?: MotionPreviewDesign | null,
): MotionCoverScrimResult {
    const t = luma == null ? 0.45 : Math.min(1, Math.max(0, luma / 255));

    let overlayWeight = 0.35;
    const rawS = previewDesign?.overlayStrength;
    if (previewDesign != null && typeof rawS === 'number' && Number.isFinite(rawS)) {
        const s = Math.min(0.92, Math.max(0.06, rawS));
        overlayWeight = Math.min(1, Math.max(0, (s - 0.06) / 0.62));
    } else if (previewDesign != null && typeof rawS !== 'number') {
        overlayWeight = 0.26;
    }

    /** Flat black, same for every theme — strong enough to read as a real cover (was too faint before). */
    let blackAlpha = luma == null ? 0.4 : 0.32 + t * 0.2;
    if (previewDesign != null && typeof rawS === 'number' && Number.isFinite(rawS)) {
        const target = 0.28 + overlayWeight * 0.34;
        blackAlpha = blackAlpha * 0.38 + target * 0.62;
        blackAlpha = Math.min(0.64, Math.max(0.22, blackAlpha));
    } else {
        blackAlpha = Math.min(0.52, Math.max(0.28, blackAlpha));
    }

    const gradient = `rgba(0,0,0,${blackAlpha.toFixed(3)})`;

    const imageOpacity = 1;

    const vignette: string | undefined = undefined;

    const w = overlayWeight;
    const textBlockShadow =
        w < 0.2
            ? '0 1px 4px rgba(0,0,0,0.34), 0 0 2px rgba(0,0,0,0.45)'
            : w < 0.38
              ? '0 2px 16px rgba(0,0,0,0.48), 0 1px 3px rgba(0,0,0,0.42)'
              : '0 5px 34px rgba(0,0,0,0.72), 0 2px 10px rgba(0,0,0,0.58), 0 0 1px rgba(0,0,0,0.45)';

    return { gradient, imageOpacity, vignette, textBlockShadow, overlayWeight };
}

/** Map AI / UI `imageFocus` — top/center/bottom use strong vertical crop cues (preview only). */
export function motionImageObjectPosition(focus?: string | null): string {
    const f = String(focus || 'center')
        .trim()
        .toLowerCase();
    if (f === 'center' || f.includes('middle')) return 'center center';
    if (f.includes('top') && !f.includes('bottom')) return 'center 16%';
    if (f.includes('bottom') && !f.includes('top')) return 'center 88%';
    const allowed = new Set(['left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']);
    if (allowed.has(f)) return f;
    if (f.includes('top') && f.includes('left')) return 'top left';
    if (f.includes('top') && f.includes('right')) return 'top right';
    if (f.includes('bottom') && f.includes('left')) return 'bottom left';
    if (f.includes('bottom') && f.includes('right')) return 'bottom right';
    if (f.includes('left')) return 'center 30%';
    if (f.includes('right')) return 'center 70%';
    return 'center center';
}

export type MotionTextPlacement = 'top' | 'center' | 'bottom' | 'side';

export function motionTextPlacementFromAi(
    value?: string | null,
    aspect?: MotionPreviewAspect | null,
): MotionTextPlacement {
    const s = String(value || '')
        .trim()
        .toLowerCase();
    const landsc = aspect === 'landscape';
    if (
        landsc &&
        (s.includes('side-card') ||
            s.includes('side card') ||
            s.includes('sidebar') ||
            s.includes('side panel') ||
            (s.includes('side') && s.includes('card')) ||
            (s.includes('side') && s.includes('panel')))
    ) {
        return 'side';
    }
    if (s.includes('top') || s.includes('upper') || s.includes('header')) return 'top';
    if (s.includes('center') || s.includes('middle') || s.includes('balanced')) return 'center';
    return 'bottom';
}

export type MotionStyleMood = 'luxury' | 'fun' | 'elegant' | 'energetic' | 'default';

export function motionStyleMoodFromAi(raw?: string | null): MotionStyleMood {
    const s = String(raw || '')
        .trim()
        .toLowerCase();
    if (/\b(luxur|premium|vip|upscale)\b/.test(s) || s.includes('luxury')) return 'luxury';
    if (/\b(fun|playful|party|festive)\b/.test(s) || s.includes('fun')) return 'fun';
    if (/\b(elegant|minimal|refined|sophisticat)\b/.test(s) || s.includes('elegant')) return 'elegant';
    if (/\b(energetic|bold|dynamic)\b/.test(s) || s.includes('energetic')) return 'energetic';
    return 'default';
}

export type MotionMoodChrome = {
    stackGapMul: number;
    rootShadow?: string;
    badgeRadius: number;
    badgePadding: string;
    badgeFontWeight: number;
    badgeBg?: string;
    ctaRadius: number;
    ctaPadding: string;
    ctaExtraShadow?: string;
    animSlidePx: number;
};

export function motionMoodChrome(theme: MotionTheme, mood: MotionStyleMood): MotionMoodChrome {
    const base: MotionMoodChrome = {
        stackGapMul: 1,
        badgeRadius: 999,
        badgePadding: '7px 14px',
        badgeFontWeight: 800,
        ctaRadius: 12,
        ctaPadding: '12px 22px',
        animSlidePx: 14,
    };
    switch (mood) {
        case 'luxury':
            return {
                ...base,
                stackGapMul: 1.45,
                rootShadow: '0 26px 64px rgba(0,0,0,0.3)',
                badgePadding: '9px 20px',
                badgeFontWeight: 700,
                ctaRadius: 10,
                ctaPadding: '11px 26px',
                animSlidePx: 5,
            };
        case 'fun':
            return {
                ...base,
                stackGapMul: 1.15,
                badgeRadius: 18,
                badgeBg: `linear-gradient(125deg, ${theme.bgSecondary}, ${hexToRgba(theme.bgPrimary, 0.92)})`,
                ctaRadius: 20,
                ctaExtraShadow: '0 14px 36px rgba(251, 146, 60, 0.42)',
                animSlidePx: 16,
            };
        case 'elegant':
            return {
                ...base,
                stackGapMul: 1.28,
                rootShadow: '0 10px 32px rgba(0,0,0,0.2)',
                ctaRadius: 8,
                ctaPadding: '10px 22px',
                animSlidePx: 4,
            };
        case 'energetic':
            return {
                ...base,
                stackGapMul: 1.05,
                badgeFontWeight: 900,
                badgePadding: '9px 18px',
                ctaExtraShadow: '0 16px 40px rgba(0,0,0,0.48)',
                animSlidePx: 18,
            };
        default:
            return base;
    }
}

/** Body copy tint from `textPrimary` — stronger when dimming / overlay strength is higher (contrast on photo). */
export function motionReadabilityMuted(theme: MotionTheme, overlayWeight: number): string {
    const u = Math.min(1, Math.max(0, overlayWeight));
    const alpha = 0.74 + u * 0.24;
    return hexToRgba(theme.textPrimary, alpha);
}

export function useMotionCardWidth<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [w, setW] = useState(360);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            setW(typeof window !== 'undefined' ? Math.min(window.innerWidth, 420) : 360);
            return;
        }
        const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
        ro.observe(el);
        setW(Math.max(260, el.clientWidth));
        return () => ro.disconnect();
    }, []);

    return [ref, w];
}

type MotionFitTitleProps = {
    text: React.ReactNode;
    textForMeasure: string;
    className?: string;
    maxLines?: number;
    minPx: number;
    maxPx: number;
    lineHeight: number;
    color: string;
    animationStyle: CSSProperties;
    /** Studio preview: heavy shadow for readability on bright images. */
    readabilityShadow?: string;
};

/** Auto-shrinks font so title fits in two lines without changing animation keyframes. */
export function MotionFitTitle({ text, textForMeasure, className, maxLines = 2, minPx, maxPx, lineHeight, color, animationStyle, readabilityShadow }: MotionFitTitleProps) {
    const ref = useRef<HTMLHeadingElement>(null);
    const [fontPx, setFontPx] = useState(maxPx);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (!textForMeasure) {
            setFontPx(maxPx);
            return;
        }
        const lh = lineHeight;
        let best = minPx;
        for (let fs = maxPx; fs >= minPx; fs -= 0.5) {
            el.style.fontSize = `${fs}px`;
            const cap = fs * lh * Math.max(2, maxLines) + 2;
            el.style.maxHeight = `${cap}px`;
            if (el.scrollHeight <= cap) {
                best = fs;
                break;
            }
        }
        setFontPx(best);
    }, [textForMeasure, minPx, maxPx, lineHeight, maxLines]);

    const cap = fontPx * lineHeight * Math.max(2, maxLines) + 2;

    return (
        <h3
            ref={ref}
            className={className}
            style={{
                margin: 0,
                marginBottom: 4,
                color,
                fontWeight: 800,
                fontSize: fontPx,
                fontFamily: "'Changa', sans-serif",
                lineHeight: Math.max(1.16, lineHeight),
                letterSpacing: 0.01,
                maxHeight: cap,
                overflow: 'hidden',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                hyphens: 'auto',
                ...(readabilityShadow ? { textShadow: readabilityShadow } : {}),
                ...animationStyle,
            }}
        >
            {text}
        </h3>
    );
}

export const motionSubtitleClamp: CSSProperties = {
    margin: 0,
    fontSize: 'clamp(12px, 3.4cqi, 15px)',
    fontFamily: "'Tajawal', sans-serif",
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
};

export const motionDescriptionClamp: CSSProperties = {
    margin: 0,
    fontSize: 'clamp(12px, 3.1cqi, 14px)',
    fontFamily: "'Tajawal', sans-serif",
    lineHeight: 1.45,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 70%, transparent 100%)',
    maskImage: 'linear-gradient(180deg, #000 0%, #000 70%, transparent 100%)',
};

/** UI-only preview aspect; persisted posts remain `format: 'square'` until storage changes. */
export type MotionPreviewAspect = 'landscape' | 'square' | 'vertical';

export const MOTION_CARD_ROOT_STYLE: CSSProperties = {
    width: '100%',
    maxWidth: 420,
    minWidth: 0,
    aspectRatio: '1 / 1',
    borderRadius: 'clamp(14px, 4cqi, 20px)',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 20px 56px rgba(0,0,0,0.38)',
    ...( { containerType: 'inline-size' } as CSSProperties ),
};

const MOTION_CARD_FRAME_COMMON: CSSProperties = {
    width: '100%',
    minWidth: 0,
    borderRadius: 'clamp(14px, 4cqi, 20px)',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 20px 56px rgba(0,0,0,0.38)',
    ...( { containerType: 'inline-size' } as CSSProperties ),
};

/** Responsive frame for studio preview only (defaults to square = same as shipped templates). */
export function motionCardRootStyleForPreviewAspect(aspect?: MotionPreviewAspect): CSSProperties {
    const a = aspect || 'square';
    if (a === 'landscape') {
        return { ...MOTION_CARD_FRAME_COMMON, aspectRatio: '16 / 9', maxWidth: 520 };
    }
    if (a === 'vertical') {
        return { ...MOTION_CARD_FRAME_COMMON, aspectRatio: '9 / 16', maxWidth: 300 };
    }
    return { ...MOTION_CARD_FRAME_COMMON, aspectRatio: '1 / 1', maxWidth: 420 };
}

export const motionContentPadding = (w: number): string => (w < 340 ? 'clamp(12px, 4vw, 16px)' : 'clamp(14px, 4.2vw, 20px)');

/** Tighter, smaller copy inside the details card (max two short lines). */
export const motionDetailsCardBodyTight: CSSProperties = {
    fontSize: 'clamp(10.5px, 2.85cqi, 12.5px)',
    lineHeight: 1.22,
};

/** Parse `#rgb` or `#rrggbb` (case-insensitive). */
export function parseHexColor(input: string): [number, number, number] | null {
    const s = String(input || '').trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (!m) return null;
    const h = m[1];
    if (h.length === 3) {
        const r = parseInt(h[0] + h[0], 16);
        const g = parseInt(h[1] + h[1], 16);
        const b = parseInt(h[2] + h[2], 16);
        return [r, g, b];
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function linearChannel(c: number): number {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance 0–1 for a hex sRGB color. */
export function relativeLuminanceFromHex(hex: string): number {
    const p = parseHexColor(hex);
    if (!p) return 0.2;
    const r = linearChannel(p[0]);
    const g = linearChannel(p[1]);
    const b = linearChannel(p[2]);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21) between two hex colors. */
export function contrastRatio(fgHex: string, bgHex: string): number {
    const l1 = relativeLuminanceFromHex(fgHex);
    const l2 = relativeLuminanceFromHex(bgHex);
    const L = Math.max(l1, l2);
    const S = Math.min(l1, l2);
    return (L + 0.05) / (S + 0.05);
}

/** Label color for text on a solid-ish hex background (e.g. CTA gradient midpoint). */
export function getReadableTextColor(backgroundHex: string): string {
    const lum = relativeLuminanceFromHex(backgroundHex);
    if (lum < 0.45) return 'rgba(255,255,255,0.97)';
    return '#101010';
}

export function motionCtaButtonStyle(theme: MotionTheme): CSSProperties {
    const bg = theme.bgSecondary;
    const lum = relativeLuminanceFromHex(bg);
    const isLightSurface = lum > 0.48;
    return {
        alignSelf: 'flex-start',
        marginTop: 4,
        background: bg,
        color: isLightSurface ? '#101010' : theme.textPrimary,
        borderRadius: 12,
        padding: '12px 22px',
        fontSize: 'clamp(12px, 3.2cqi, 14px)',
        fontWeight: 900,
        fontFamily: "'Cairo', sans-serif",
        letterSpacing: 0.03,
        textShadow: isLightSurface ? '0 1px 0 rgba(255,255,255,0.35)' : '0 1px 2px rgba(0,0,0,0.45)',
        border: isLightSurface ? '1px solid rgba(0,0,0,0.12)' : `1px solid ${hexToRgba(theme.bgPrimary, 0.35)}`,
        boxShadow: '0 10px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)',
        boxSizing: 'border-box',
    };
}

/** CTA fill from theme surface roles only. */
export function motionThemeCtaGradient(theme: MotionTheme): string {
    return `linear-gradient(128deg, ${theme.bgPrimary} 0%, ${theme.bgSecondary} 100%)`;
}

/** Glow uses tinted `bg*` only. */
export function motionThemeCtaLayeredShadow(
    theme: MotionTheme,
    baseBoxShadow: string | undefined,
    extraChromeShadow?: string,
): string {
    const glow = `0 0 36px ${hexToRgba(theme.bgSecondary, 0.58)}, 0 0 64px ${hexToRgba(theme.bgPrimary, 0.38)}`;
    const lift = `0 16px 38px rgba(0,0,0,0.52)`;
    const inset = `inset 0 1px 0 rgba(255,255,255,0.26)`;
    const parts = [extraChromeShadow, glow, lift, inset, baseBoxShadow].filter(Boolean) as string[];
    return parts.join(', ');
}

function averageHexColors(hexes: string[]): string {
    const rgb = hexes
        .map(parseHexColor)
        .filter(Boolean) as [number, number, number][];
    if (!rgb.length) return '#333333';
    const n = rgb.length;
    const r = Math.round(rgb.reduce((s, c) => s + c[0], 0) / n);
    const g = Math.round(rgb.reduce((s, c) => s + c[1], 0) / n);
    const b = Math.round(rgb.reduce((s, c) => s + c[2], 0) / n);
    const h = (x: number) => x.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * CTA label colors for keyword-gradient buttons: high contrast vs gradient midpoint,
 * optional shadow only when it helps (light text on dark mid-tone).
 */
export function motionCtaLabelContrastStyle(theme: MotionTheme): { color: string; textShadow?: string } {
    const mid = averageHexColors([theme.bgPrimary, theme.bgSecondary]);
    const color = getReadableTextColor(mid);
    const lum = relativeLuminanceFromHex(mid);
    if (lum < 0.45) {
        return { color, textShadow: '0 1px 2px rgba(0,0,0,0.55)' };
    }
    return { color, textShadow: '0 1px 0 rgba(255,255,255,0.4)' };
}

/** Single allowed highlight tone — always from theme's light accent role. */
export function pickMotionHighlightColor(theme: MotionTheme): string {
    return theme.textAccent;
}

type MotionTextContext = 'title' | 'body' | 'cta';

function isWordLikeChar(ch: string | undefined): boolean {
    if (!ch) return false;
    return /[0-9A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(ch);
}

function containsArabic(s: string): boolean {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(s);
}

export function renderHighlightedMotionText(
    text: string | undefined,
    theme: MotionTheme,
    context: MotionTextContext = 'body',
    options?: { quotedHighlights?: boolean },
): React.ReactNode {
    const input = String(text || '');
    if (!input.trim()) return input;
    /** CTA stays plain — parent sets final label color for contrast on gradients. */
    if (context === 'cta') return input;

    if (options?.quotedHighlights) {
        const highlightColor = pickMotionHighlightColor(theme);
        const subtleHiShadow =
            relativeLuminanceFromHex(highlightColor) > 0.55
                ? '0 0 10px rgba(0,0,0,0.35)'
                : '0 0 8px rgba(0,0,0,0.45)';
        // Strict marker mode for regular_post only: highlight only ""..."" pairs.
        // If any opening marker is unmatched, keep original text unchanged.
        const out: React.ReactNode[] = [];
        let i = 0;
        let key = 0;
        const marker = '""';
        while (i < input.length) {
            const open = input.indexOf(marker, i);
            if (open < 0) {
                out.push(input.slice(i));
                break;
            }
            const close = input.indexOf(marker, open + marker.length);
            if (close < 0) {
                return input;
            }
            if (open > i) out.push(input.slice(i, open));
            const phrase = input.slice(open + marker.length, close);
            if (phrase.length > 0) {
                const segIsArabic = containsArabic(phrase);
                out.push(
                    <span
                        key={`qh-${key++}`}
                        className="motion-highlight"
                        style={{
                            color: highlightColor,
                            fontWeight: context === 'title' ? 920 : 860,
                            textShadow: subtleHiShadow,
                            unicodeBidi: segIsArabic ? 'isolate' : undefined,
                            direction: segIsArabic ? 'rtl' : undefined,
                            display: 'inline',
                        }}
                    >
                        {phrase}
                    </span>,
                );
            } else {
                // Empty marker pair should simply disappear.
            }
            i = close + marker.length;
        }
        return <>{out}</>;
    }

    const highlightColor = pickMotionHighlightColor(theme);
    const rules = [
        { phrase: 'خصم 20%', weight: 900 },
        { phrase: 'عيد الأم', weight: 900 },
        { phrase: 'عرض خاص', weight: 860 },
        { phrase: 'احجز الآن', weight: 900 },
        { phrase: 'سوشي', weight: 860 },
        { phrase: '20%', weight: 900 },
    ].sort((a, b) => b.phrase.length - a.phrase.length);

    const lower = input.toLowerCase();
    let chosen: { start: number; end: number; weight: number; text: string } | null = null;
    for (const rule of rules) {
        const needle = rule.phrase.toLowerCase();
        const idx = lower.indexOf(needle);
        if (idx < 0) continue;
        const end = idx + needle.length;
        const prev = input[idx - 1];
        const next = input[end];
        const leftOk = idx === 0 || !isWordLikeChar(prev);
        const rightOk = end === input.length || !isWordLikeChar(next);
        if (leftOk && rightOk) {
            chosen = { start: idx, end, weight: rule.weight, text: input.slice(idx, end) };
            break;
        }
    }

    if (!chosen) return input;

    const seg = chosen;
    const segIsArabic = containsArabic(seg.text);
    const hiLum = relativeLuminanceFromHex(highlightColor);
    const subtleHiShadow =
        hiLum > 0.55 ? '0 0 10px rgba(0,0,0,0.35)' : '0 0 8px rgba(0,0,0,0.45)';

    const out: React.ReactNode[] = [];
    if (seg.start > 0) out.push(input.slice(0, seg.start));
    out.push(
        <span
            key={`kw-${seg.start}`}
            style={{
                color: highlightColor,
                fontWeight: context === 'title' ? Math.max(seg.weight, 920) : seg.weight,
                textShadow: subtleHiShadow,
                unicodeBidi: segIsArabic ? 'isolate' : undefined,
                direction: segIsArabic ? 'rtl' : undefined,
                display: 'inline',
            }}
        >
            {seg.text}
        </span>,
    );
    if (seg.end < input.length) out.push(input.slice(seg.end));
    /** Title parents use `textPrimary`; body keeps parent `muted` except the one `textAccent` span. */
    return <>{out}</>;
}

export function motionArtisticArabicTitle(text: string | undefined): string {
    const input = String(text || '').trim();
    if (!input) return '';
    const isArabic = /[\u0600-\u06FF]/.test(input);
    if (!isArabic) return input;
    if (/\n/.test(input)) return input;

    if (input.includes('عيد الأم') && input.includes('سوشي')) {
        const before = input.split('عيد الأم')[0].trim();
        const afterMother = input.split('عيد الأم')[1] || '';
        const sushiPart = afterMother.includes('سوشي') ? `مع سوشي` : afterMother.trim();
        const firstLine = before || 'احتفل بـ';
        return `${firstLine}\nعيد الأم\n${sushiPart}`.trim();
    }

    const words = input.split(/\s+/).filter(Boolean);
    if (words.length <= 2) return input;
    if (words.length <= 4) return `${words.slice(0, 2).join(' ')}\n${words.slice(2).join(' ')}`;
    return `${words.slice(0, 2).join(' ')}\n${words.slice(2, 4).join(' ')}\n${words.slice(4).join(' ')}`;
}

export function motionHeroTitleLines(text: string | undefined): { intro: string; hero: string; outro: string } {
    const normalized = motionArtisticArabicTitle(text);
    const lines = normalized
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!lines.length) return { intro: '', hero: '', outro: '' };
    if (lines.length === 1) return { intro: '', hero: lines[0], outro: '' };
    if (lines.length === 2) return { intro: lines[0], hero: lines[1], outro: '' };
    return {
        intro: lines[0],
        hero: lines[1],
        outro: lines.slice(2).join(' '),
    };
}

export function motionDecorativeIconForTitle(text: string | undefined): string {
    const s = String(text || '');
    if (/عيد|الأم|ام|حب/u.test(s)) return '🌸';
    if (/سوشي|مطعم|طعام|عشاء/u.test(s)) return '✨';
    if (/عرض|خصم|%/u.test(s)) return '💫';
    return '✨';
}