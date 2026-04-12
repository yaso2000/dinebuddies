import React, { createContext, useContext, useEffect, useState } from 'react';
import { buildTheme } from '../theme/buildTheme';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

const STORAGE_KEY = 'theme';

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(() => {
        if (typeof window === 'undefined') return 'dark';
        return localStorage.getItem(STORAGE_KEY) || 'dark';
    });

    const [brandColor, setBrandColor] = useState(null); // Allows profiles to set dynamic brands

    const isDark = themeMode === 'dark';

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
        document.body.classList.toggle('light-mode', themeMode === 'light');
        localStorage.setItem(STORAGE_KEY, themeMode);

        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', themeMode === 'dark' ? '#0b0812' : '#f8fafc');
        }

        // Apply dynamic theme variables globally
        const themeVars = buildTheme({ mode: themeMode, brandColor });
        const root = document.documentElement;
        
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

    }, [themeMode, brandColor]);

    const toggleTheme = () => {
        setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const setTheme = (mode) => {
        if (mode === 'dark' || mode === 'light') setThemeMode(mode);
    };

    const value = {
        themeMode,
        isDark,
        toggleTheme,
        setTheme,
        brandColor,
        setBrandColor, // Exposed for pages like BusinessProfile
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
