/**
 * Business Profile Theme Registry
 * Curated themes + DineBuddies default (app primary orange).
 * Fully compatible with both Dark and Light modes using alpha-transparencies.
 */

export const DINEBUDDIES_THEME_ID = 'dinebuddies';
export const APP_PRIMARY_COLOR = '#E86E2E';
export const APP_PRIMARY_HOVER = '#d85a20';

/** UI colors derived from app primary — used for profile sections (hours, menu, gallery). */
export function buildUiColorsFromPrimary(primary = APP_PRIMARY_COLOR, secondary = APP_PRIMARY_HOVER) {
    return {
        cardBg: null,
        gradientFrom: 'rgba(232, 110, 46, 0.85)',
        gradientTo: 'rgba(216, 90, 32, 0.95)',
        accent: primary,
        accentText: '#ffffff',
        border: `color-mix(in srgb, ${primary} 30%, transparent)`,
        footerBg: `linear-gradient(135deg, ${primary}, ${secondary})`,
        badgeBg: `color-mix(in srgb, ${primary} 12%, transparent)`,
        badgeText: primary,
        headerGlow: `0 0 30px color-mix(in srgb, ${primary} 30%, transparent)`,
        tabActive: primary,
        swatchGradient: `linear-gradient(135deg, #ea7a40, ${primary})`,
        btnShadow: `0 4px 15px color-mix(in srgb, ${primary} 30%, transparent)`,
        cardShadow: `0 4px 20px color-mix(in srgb, ${primary} 15%, transparent), 0 0 0 1px color-mix(in srgb, ${primary} 20%, transparent)`,
        btnBorderRadius: '14px',
    };
}

/** Resolve stored theme id; empty/unknown → DineBuddies default. */
export function resolveBusinessProfileThemeId(themeId) {
    const id = String(themeId || '').trim();
    if (!id || id === 'default') return DINEBUDDIES_THEME_ID;
    if (BUSINESS_THEMES.some((t) => t.id === id)) return id;
    return DINEBUDDIES_THEME_ID;
}

const LEGACY_GOLD_PRIMARIES = new Set(['#d4af37', '#997a00', 'd4af37', '997a00']);

function normalizeBrandPrimaryForUi(brandPrimaryColor) {
    if (!brandPrimaryColor) return null;
    const key = String(brandPrimaryColor).trim().toLowerCase();
    const withHash = key.startsWith('#') ? key : `#${key}`;
    if (LEGACY_GOLD_PRIMARIES.has(key) || LEGACY_GOLD_PRIMARIES.has(withHash)) {
        return null;
    }
    return brandPrimaryColor;
}

/**
 * Colors for profile UI (tabs, hours, menu, gallery).
 * Priority: brandKit.primaryColor → selected theme → app default.
 */
export function getBusinessProfileUiColors(brandPrimaryColor, themeColors) {
    const primary = normalizeBrandPrimaryForUi(brandPrimaryColor);
    if (primary) {
        const secondary =
            themeColors?.badgeText && themeColors.badgeText !== primary
                ? themeColors.badgeText
                : themeColors?.accent && themeColors.accent !== primary
                  ? themeColors.accent
                  : primary;
        return { ...buildUiColorsFromPrimary(primary, secondary), ...(themeColors || {}) };
    }
    if (themeColors?.accent) {
        const accent = themeColors.accent;
        const secondary = themeColors.badgeText || accent;
        return {
            ...buildUiColorsFromPrimary(accent, secondary),
            ...themeColors,
            tabActive: themeColors.tabActive || accent,
        };
    }
    return buildUiColorsFromPrimary();
}

export const BUSINESS_THEMES = [
    {
        id: DINEBUDDIES_THEME_ID,
        name: 'DineBuddies',
        emoji: '🍊',
        isPremium: false,
        description: 'Default app brand orange',
        colors: buildUiColorsFromPrimary(),
    },
    {
        id: 'golden_elegance',
        name: 'Golden Elegance',
        emoji: '✨',
        isPremium: false,
        description: 'Luxurious gold and amber aesthetic',
        colors: {
            // No opaque backgrounds to support native Light/Dark modes
            cardBg: null, 
            gradientFrom: 'rgba(212, 175, 55, 0.85)',
            gradientTo: 'rgba(153, 122, 0, 0.95)',
            accent: '#d4af37',
            accentText: '#ffffff',
            border: 'rgba(212, 175, 55, 0.3)',
            footerBg: 'linear-gradient(135deg, #d4af37, #997a00)',
            badgeBg: 'rgba(212, 175, 55, 0.15)',
            badgeText: '#d4af37',
            headerGlow: '0 0 30px rgba(212, 175, 55, 0.3)',
            tabActive: '#d4af37',
            swatchGradient: 'linear-gradient(135deg, #fceabb, #f8b500)',
            btnShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
            cardShadow: '0 4px 20px rgba(212, 175, 55, 0.15), 0 0 0 1px rgba(212, 175, 55, 0.2)',
            btnBorderRadius: '24px',
        },
    },
    {
        id: 'ruby_velvet',
        name: 'Ruby Velvet',
        emoji: '🍷',
        isPremium: false,
        description: 'Rich burgundy and bold crimson',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(225, 29, 72, 0.85)',
            gradientTo: 'rgba(159, 18, 57, 0.95)',
            accent: '#e11d48',
            accentText: '#ffffff',
            border: 'rgba(225, 29, 72, 0.3)',
            footerBg: 'linear-gradient(135deg, #e11d48, #be123c)',
            badgeBg: 'rgba(225, 29, 72, 0.12)',
            badgeText: '#e11d48',
            headerGlow: '0 0 30px rgba(225, 29, 72, 0.3)',
            tabActive: '#e11d48',
            swatchGradient: 'linear-gradient(135deg, #fb7185, #e11d48)',
            btnShadow: '0 4px 15px rgba(225, 29, 72, 0.3)',
            cardShadow: '0 4px 20px rgba(225, 29, 72, 0.15), 0 0 0 1px rgba(225, 29, 72, 0.2)',
            btnBorderRadius: '16px',
        },
    },
    {
        id: 'royal_sapphire',
        name: 'Royal Sapphire',
        emoji: '💎',
        isPremium: false,
        description: 'Classic deep blue and azure tones',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(37, 99, 235, 0.85)',
            gradientTo: 'rgba(29, 78, 216, 0.95)',
            accent: '#3b82f6',
            accentText: '#ffffff',
            border: 'rgba(59, 130, 246, 0.3)',
            footerBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            badgeBg: 'rgba(59, 130, 246, 0.12)',
            badgeText: '#3b82f6',
            headerGlow: '0 0 30px rgba(59, 130, 246, 0.3)',
            tabActive: '#3b82f6',
            swatchGradient: 'linear-gradient(135deg, #60a5fa, #2563eb)',
            btnShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
            cardShadow: '0 4px 20px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)',
            btnBorderRadius: '16px',
        },
    },
    {
        id: 'emerald_prestige',
        name: 'Emerald Prestige',
        emoji: '🌿',
        isPremium: false,
        description: 'Vibrant forest green and jade',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(16, 185, 129, 0.85)',
            gradientTo: 'rgba(4, 120, 87, 0.95)',
            accent: '#10b981',
            accentText: '#ffffff',
            border: 'rgba(16, 185, 129, 0.3)',
            footerBg: 'linear-gradient(135deg, #10b981, #047857)',
            badgeBg: 'rgba(16, 185, 129, 0.12)',
            badgeText: '#10b981',
            headerGlow: '0 0 30px rgba(16, 185, 129, 0.3)',
            tabActive: '#10b981',
            swatchGradient: 'linear-gradient(135deg, #34d399, #059669)',
            btnShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            cardShadow: '0 4px 20px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)',
            btnBorderRadius: '16px',
        },
    },
    {
        id: 'amethyst_glow',
        name: 'Amethyst Glow',
        emoji: '🔮',
        isPremium: false,
        description: 'Sleek purple and modern violet',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(139, 92, 246, 0.85)',
            gradientTo: 'rgba(109, 40, 217, 0.95)',
            accent: '#8b5cf6',
            accentText: '#ffffff',
            border: 'rgba(139, 92, 246, 0.3)',
            footerBg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            badgeBg: 'rgba(139, 92, 246, 0.12)',
            badgeText: '#8b5cf6',
            headerGlow: '0 0 30px rgba(139, 92, 246, 0.3)',
            tabActive: '#8b5cf6',
            swatchGradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            btnShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
            cardShadow: '0 4px 20px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)',
            btnBorderRadius: '12px',
        },
    },
    {
        id: 'cyber_neon',
        name: 'Cyber Neon',
        emoji: '⚡',
        isPremium: false,
        description: 'Futuristic cyan and magenta mix',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(6, 182, 212, 0.85)',
            gradientTo: 'rgba(236, 72, 153, 0.95)',
            accent: '#06b6d4',
            accentText: '#ffffff',
            border: 'rgba(6, 182, 212, 0.3)',
            footerBg: 'linear-gradient(135deg, #06b6d4, #ec4899)',
            badgeBg: 'rgba(6, 182, 212, 0.12)',
            badgeText: '#06b6d4',
            headerGlow: '0 0 30px rgba(6, 182, 212, 0.3)',
            tabActive: '#06b6d4',
            swatchGradient: 'linear-gradient(135deg, #06b6d4, #ec4899)',
            btnShadow: '0 4px 15px rgba(6, 182, 212, 0.3)',
            cardShadow: '0 4px 20px rgba(6, 182, 212, 0.15), 0 0 0 1px rgba(6, 182, 212, 0.2)',
            btnBorderRadius: '8px',
        },
    },
    {
        id: 'signature_orange',
        name: 'Signature Orange',
        emoji: '🔥',
        isPremium: false,
        description: 'Vibrant orange with a subtle warm glow',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(234, 88, 12, 0.85)',
            gradientTo: 'rgba(249, 115, 22, 0.95)',
            accent: '#ea580c',
            accentText: '#ffffff',
            border: 'rgba(234, 88, 12, 0.3)',
            footerBg: 'linear-gradient(135deg, #ea580c, #f97316)',
            badgeBg: 'rgba(234, 88, 12, 0.12)',
            badgeText: '#ea580c',
            headerGlow: '0 0 30px rgba(234, 88, 12, 0.3)',
            tabActive: '#ea580c',
            swatchGradient: 'linear-gradient(135deg, #f97316, #fb923c)',
            btnShadow: '0 4px 15px rgba(234, 88, 12, 0.3)',
            cardShadow: '0 4px 20px rgba(234, 88, 12, 0.15), 0 0 0 1px rgba(234, 88, 12, 0.2)',
            btnBorderRadius: '20px',
        },
    },
    {
        id: 'cosmic_wave',
        name: 'Cosmic Wave',
        emoji: '🌌',
        isPremium: false,
        description: 'Striking purple to sky blue gradient',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(124, 58, 237, 0.85)',
            gradientTo: 'rgba(14, 165, 233, 0.95)',
            accent: '#8b5cf6',
            accentText: '#ffffff',
            border: 'rgba(124, 58, 237, 0.3)',
            footerBg: 'linear-gradient(135deg, #7c3aed, #0ea5e9)',
            badgeBg: 'rgba(124, 58, 237, 0.12)',
            badgeText: '#8b5cf6',
            headerGlow: '0 0 30px rgba(124, 58, 237, 0.3)',
            tabActive: '#8b5cf6',
            swatchGradient: 'linear-gradient(135deg, #7c3aed, #0ea5e9)',
            btnShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
            cardShadow: '0 4px 20px rgba(124, 58, 237, 0.15), 0 0 0 1px rgba(124, 58, 237, 0.2)',
            btnBorderRadius: '16px',
        },
    },
    {
        id: 'copper_steel',
        name: 'Copper & Steel',
        emoji: '🛡️',
        isPremium: false,
        description: 'High-contrast orange and cool silver',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(217, 119, 6, 0.85)',
            gradientTo: 'rgba(148, 163, 184, 0.95)',
            accent: '#d97706',
            accentText: '#ffffff',
            border: 'rgba(217, 119, 6, 0.3)',
            footerBg: 'linear-gradient(135deg, #d97706, #94a3b8)',
            badgeBg: 'rgba(217, 119, 6, 0.12)',
            badgeText: '#d97706',
            headerGlow: '0 0 30px rgba(217, 119, 6, 0.3)',
            tabActive: '#d97706',
            swatchGradient: 'linear-gradient(135deg, #d97706, #cbd5e1)',
            btnShadow: '0 4px 15px rgba(217, 119, 6, 0.3)',
            cardShadow: '0 4px 20px rgba(217, 119, 6, 0.15), 0 0 0 1px rgba(217, 119, 6, 0.2)',
            btnBorderRadius: '12px',
        },
    },
    {
        id: 'tropical_sunset',
        name: 'Tropical Sunset',
        emoji: '🍹',
        isPremium: false,
        description: 'Vibrant hot pink to warm orange',
        colors: {
            cardBg: null,
            gradientFrom: 'rgba(244, 63, 94, 0.85)',
            gradientTo: 'rgba(245, 158, 11, 0.95)',
            accent: '#f43f5e',
            accentText: '#ffffff',
            border: 'rgba(244, 63, 94, 0.3)',
            footerBg: 'linear-gradient(135deg, #f43f5e, #f59e0b)',
            badgeBg: 'rgba(244, 63, 94, 0.12)',
            badgeText: '#f43f5e',
            headerGlow: '0 0 30px rgba(244, 63, 94, 0.3)',
            tabActive: '#f43f5e',
            swatchGradient: 'linear-gradient(135deg, #f43f5e, #fbd38d)',
            btnShadow: '0 4px 15px rgba(244, 63, 94, 0.3)',
            cardShadow: '0 4px 20px rgba(244, 63, 94, 0.15), 0 0 0 1px rgba(244, 63, 94, 0.2)',
            btnBorderRadius: '24px',
        },
    }
];

export const getTheme = (id) => {
    const resolved = resolveBusinessProfileThemeId(id);
    return BUSINESS_THEMES.find((t) => t.id === resolved) || BUSINESS_THEMES[0];
};
