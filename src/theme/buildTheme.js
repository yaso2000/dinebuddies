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

export const buildTheme = ({ mode, brandColor }) => {
    const isDark = mode === 'dark';
    
    // A) Base Tokens
    const baseTokens = {
        bgPrimary: isDark ? '#121212' : '#f8fafc',
        bgSecondary: isDark ? '#1e1e2e' : '#ffffff',
        bgCard: isDark ? '#1e1e2e' : '#ffffff',
        textPrimary: isDark ? '#f8fafc' : '#0f172a',    // strict base theme texts
        textSecondary: isDark ? '#94a3b8' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        iconPrimary: isDark ? '#cbd5e1' : '#334155',
        iconSecondary: isDark ? '#64748b' : '#94a3b8',
    };

    // B) Brand Tokens
    const primaryBrand = brandColor || (isDark ? '#8b5cf6' : '#6d28d9'); // default purple
    const textOnBrandVal = getReadableTextColor(primaryBrand);

    const brandTokens = {
        brandPrimary: primaryBrand,
        brandGlow: hexToRgba(primaryBrand, 0.4),
        textOnBrand: textOnBrandVal,
    };

    return { ...baseTokens, ...brandTokens };
};
