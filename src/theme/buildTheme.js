export const getLuminance = (hex) => {
    try {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16) / 255;
        const g = parseInt(h.slice(2, 4), 16) / 255;
        const b = parseInt(h.slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    } catch { return 0; }
};

export const getReadableTextColor = (hex) => {
    // If the background luminance is high (light), return black text.
    // If it's low (dark), return white text. (Threshold is typically 0.179 but 0.4 works well visually)
    return getLuminance(hex) > 0.4 ? '#000000' : '#ffffff';
};

export const hexToRgba = (hex, alpha) => {
    try {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch { return `rgba(0,0,0,${alpha})`; }
};

export const contrastRatio = (hex1, hex2) => {
    const l1 = getLuminance(hex1) + 0.05;
    const l2 = getLuminance(hex2) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
};

export const ensureContrast = (bgHex, textHex) => {
    if (contrastRatio(bgHex, textHex) < 4.5) {
        return getReadableTextColor(bgHex);
    }
    return textHex;
};

const BUSINESS_ORANGE = '#E86E2E';
const AFFILIATE_GREEN = '#16a34a';
const AFFILIATE_GREEN_DARK = '#22c55e';

export const buildTheme = ({ mode, brandColor, accountVariant = 'personal' }) => {
    const isDark = mode === 'dark';
    const isBusinessAccount = accountVariant === 'business';
    const isAffiliateAccount = accountVariant === 'affiliate';

    // A) Base Tokens — business orange wash; affiliate green wash; personal default
    const baseTokens = isBusinessAccount
        ? {
              bgPrimary: isDark ? '#100c09' : '#faf7f4',
              bgSecondary: isDark ? '#1c1410' : '#fff8f3',
              bgCard: isDark ? 'rgba(32, 22, 16, 0.92)' : '#fffefb',
              textPrimary: isDark ? '#faf7f4' : '#1c1917',
              textSecondary: isDark ? '#d6d3d1' : '#57534e',
              borderColor: isDark ? 'rgba(251, 146, 60, 0.22)' : 'rgba(180, 83, 9, 0.18)',
              iconPrimary: isDark ? '#fdba74' : '#9a3412',
              iconSecondary: isDark ? '#a8a29e' : '#78716c',
          }
        : isAffiliateAccount
          ? {
                bgPrimary: isDark ? '#0a120e' : '#f4faf6',
                bgSecondary: isDark ? '#101a12' : '#ecfdf3',
                bgCard: isDark ? 'rgba(16, 28, 20, 0.94)' : '#f8fef9',
                textPrimary: isDark ? '#ecfdf5' : '#14532d',
                textSecondary: isDark ? '#a7c4b0' : '#3f6212',
                borderColor: isDark ? 'rgba(34, 197, 94, 0.22)' : 'rgba(22, 163, 74, 0.2)',
                iconPrimary: isDark ? '#86efac' : '#166534',
                iconSecondary: isDark ? '#6b8f74' : '#4d7c0f',
            }
          : {
                bgPrimary: isDark ? '#121212' : '#f8fafc',
                bgSecondary: isDark ? '#1e1e2e' : '#ffffff',
                bgCard: isDark ? '#1e1e2e' : '#ffffff',
                textPrimary: isDark ? '#f8fafc' : '#0f172a',
                textSecondary: isDark ? '#94a3b8' : '#475569',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                iconPrimary: isDark ? '#cbd5e1' : '#334155',
                iconSecondary: isDark ? '#64748b' : '#94a3b8',
            };

    // B) Brand Tokens
    const primaryBrand =
        brandColor ||
        (isBusinessAccount
            ? BUSINESS_ORANGE
            : isAffiliateAccount
              ? isDark
                  ? AFFILIATE_GREEN_DARK
                  : AFFILIATE_GREEN
              : isDark
                ? '#8b5cf6'
                : '#6d28d9');
    const textOnBrandVal = getReadableTextColor(primaryBrand);

    const brandTokens = {
        brandPrimary: primaryBrand,
        brandGlow: hexToRgba(primaryBrand, 0.4),
        textOnBrand: textOnBrandVal,
    };

    return { ...baseTokens, ...brandTokens };
};
