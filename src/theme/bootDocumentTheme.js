import { buildTheme } from './buildTheme';

export const THEME_STORAGE_KEY = 'theme';

const BUSINESS_BOOT_PREFIXES = [
    '/business-dashboard',
    '/business/onboarding',
    '/business/pricing',
    '/signup/business',
    '/business/signup',
    '/business-signup',
];

export function readStoredThemeMode() {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
}

/** Minimal route/session hint before React — matches accountTheme.js boot needs. */
export function readBootAccountTheme() {
    if (typeof window === 'undefined') return 'personal';

    try {
        if (sessionStorage.getItem('dineb_biz_uid')) return 'business';
    } catch {
        /* ignore */
    }

    const path = window.location.pathname || '';
    const search = window.location.search || '';

    if (path === '/login' || path.startsWith('/business/login')) {
        const tab = new URLSearchParams(search).get('tab');
        return tab === 'business' ? 'business' : 'personal';
    }

    if (BUSINESS_BOOT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return 'business';
    }

    if (path === '/affiliate' || path.startsWith('/affiliate/')) {
        return 'affiliate';
    }

    return 'personal';
}

/**
 * Apply theme tokens to <html> synchronously (before paint when called from boot).
 */
export function applyDocumentTheme({ themeMode, accountTheme, brandColor = null }) {
    if (typeof document === 'undefined') return;

    const isBusinessTheme = accountTheme === 'business';
    const isAffiliateTheme = accountTheme === 'affiliate';
    const themeVars = buildTheme({
        mode: themeMode,
        brandColor,
        accountVariant: accountTheme,
    });

    const root = document.documentElement;
    root.setAttribute('data-theme', themeMode);
    root.setAttribute('data-account-theme', accountTheme);
    document.body.classList.toggle('light-mode', themeMode === 'light');
    document.body.classList.toggle('business-account-theme', isBusinessTheme);
    document.body.classList.toggle('affiliate-account-theme', isAffiliateTheme);

    root.style.setProperty('--bg-primary', themeVars.bgPrimary);
    root.style.setProperty('--bg-secondary', themeVars.bgSecondary);
    root.style.setProperty('--bg-card', themeVars.bgCard);
    root.style.setProperty('--text-primary', themeVars.textPrimary);
    root.style.setProperty('--text-secondary', themeVars.textSecondary);
    root.style.setProperty('--border-color', themeVars.borderColor);
    root.style.setProperty('--icon-primary', themeVars.iconPrimary);
    root.style.setProperty('--icon-secondary', themeVars.iconSecondary);
    root.style.setProperty('--brand-primary', themeVars.brandPrimary);
    root.style.setProperty('--brand-glow', themeVars.brandGlow);
    root.style.setProperty('--text-on-brand', themeVars.textOnBrand);

    if (isBusinessTheme) {
        root.style.setProperty('--primary', '#E86E2E');
        root.style.setProperty('--primary-hover', '#d85a20');
        root.style.setProperty('--luxury-gold', '#E86E2E');
        root.style.setProperty('--secondary', '#ea7a40');
        root.style.setProperty('--accent', '#d85a20');
    } else if (isAffiliateTheme) {
        const primary = themeMode === 'dark' ? '#22c55e' : '#16a34a';
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-hover', themeMode === 'dark' ? '#16a34a' : '#15803d');
        root.style.setProperty('--luxury-gold', primary);
        root.style.setProperty('--secondary', themeMode === 'dark' ? '#4ade80' : '#22c55e');
        root.style.setProperty('--accent', themeMode === 'dark' ? '#16a34a' : '#15803d');
    } else {
        root.style.removeProperty('--primary');
        root.style.removeProperty('--primary-hover');
        root.style.removeProperty('--luxury-gold');
        root.style.removeProperty('--secondary');
        root.style.removeProperty('--accent');
    }

    const metaThemeColor =
        document.getElementById('meta-theme-color') ||
        document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
        if (isBusinessTheme) {
            metaThemeColor.setAttribute('content', themeMode === 'dark' ? '#100c09' : '#faf7f4');
        } else if (isAffiliateTheme) {
            metaThemeColor.setAttribute('content', themeMode === 'dark' ? '#0a120e' : '#f4faf6');
        } else {
            metaThemeColor.setAttribute('content', themeMode === 'dark' ? '#0b0812' : '#f8fafc');
        }
    }
}

export function bootDocumentTheme() {
    applyDocumentTheme({
        themeMode: readStoredThemeMode(),
        accountTheme: readBootAccountTheme(),
    });
}
