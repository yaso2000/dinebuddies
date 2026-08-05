export type MotionThemeId = 'midnight' | 'sunset' | 'emerald' | 'violet' | 'mono' | 'rose' | 'noir';

/** Strict roles: only `bg*` for surfaces / gradients / borders; only `text*` for copy (never bg as text). */
export type MotionTheme = {
    id: MotionThemeId;
    name: string;
    /** Darker base surface — card gradient start, overlay tint, CTA start. */
    bgPrimary: string;
    /** Second deep / mid-dark surface — card gradient end, CTA end, border tint base. */
    bgSecondary: string;
    /** Main readable foreground (titles, body default, button label default). */
    textPrimary: string;
    /** Single highlight tone (one keyword in title/body) — must read on dark photo areas. */
    textAccent: string;
};

function parseHex6(hex: string): [number, number, number] | null {
    const s = String(hex || '').trim();
    const m = /^#([0-9a-f]{6})$/i.exec(s);
    if (!m) return null;
    const h = m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** RGBA from a 6-digit hex (for overlays, borders, cards). */
export function hexToRgba(hex: string, alpha: number): string {
    const p = parseHex6(hex);
    if (!p) return `rgba(0,0,0,${alpha})`;
    const a = Math.min(1, Math.max(0, alpha));
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a})`;
}

/** Full card canvas (two dark stops only). */
export function motionThemeCanvasBackground(theme: MotionTheme): string {
    return `linear-gradient(160deg, ${theme.bgPrimary} 0%, ${theme.bgSecondary} 100%)`;
}

/** Standard outline using bgSecondary tint (not text colors). */
export function motionThemeOutlineBorder(theme: MotionTheme, alpha = 0.38): string {
    return `1px solid ${hexToRgba(theme.bgSecondary, alpha)}`;
}

/**
 * Six themes: each uses **two dark** (`bgPrimary`, `bgSecondary`) and **two light**
 * (`textPrimary`, `textAccent`). IDs unchanged for Firestore / studio compatibility.
 */
export const MOTION_THEMES: Record<MotionThemeId, MotionTheme> = {
    midnight: {
        id: 'midnight',
        name: 'Ocean Night',
        bgPrimary: '#051525',
        bgSecondary: '#164a6e',
        textPrimary: '#f1f5f9',
        textAccent: '#bae6fd',
    },
    sunset: {
        id: 'sunset',
        name: 'Sunset Glow',
        bgPrimary: '#2a1018',
        bgSecondary: '#6b1f3d',
        textPrimary: '#fff7ed',
        textAccent: '#fcd34d',
    },
    emerald: {
        id: 'emerald',
        name: 'Forest Mint',
        bgPrimary: '#0c241c',
        bgSecondary: '#1a5a45',
        textPrimary: '#ecfdf5',
        textAccent: '#bbf7d0',
    },
    violet: {
        id: 'violet',
        name: 'Royal Purple',
        bgPrimary: '#150f24',
        bgSecondary: '#4a2a7a',
        textPrimary: '#f5f3ff',
        textAccent: '#e9d5ff',
    },
    mono: {
        id: 'mono',
        name: 'Golden Luxe',
        bgPrimary: '#22180c',
        bgSecondary: '#5c4520',
        textPrimary: '#fffbeb',
        textAccent: '#fde68a',
    },
    rose: {
        id: 'rose',
        name: 'Rose Blush',
        bgPrimary: '#2a0f18',
        bgSecondary: '#6d2a4a',
        textPrimary: '#fff1f2',
        textAccent: '#fecdd3',
    },
    noir: {
        id: 'noir',
        name: 'Noir Mono',
        bgPrimary: '#050505',
        bgSecondary: '#2a2a2a',
        textPrimary: '#f8fafc',
        textAccent: '#d4d4d8',
    },
};

export const DEFAULT_MOTION_THEME_ID: MotionThemeId = 'midnight';
