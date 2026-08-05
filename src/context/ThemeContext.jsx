import React, { createContext, useContext, useLayoutEffect, useState, useCallback } from 'react';
import {
    applyDocumentTheme,
    readStoredThemeMode,
    THEME_STORAGE_KEY,
} from '../theme/bootDocumentTheme';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(readStoredThemeMode);
    const [brandColor, setBrandColor] = useState(null);
    const [accountTheme, setAccountThemeState] = useState('personal');

    const isDark = themeMode === 'dark';
    const isBusinessTheme = accountTheme === 'business';
    const isAffiliateTheme = accountTheme === 'affiliate';

    const setAccountTheme = useCallback((next) => {
        if (next === 'business' || next === 'personal' || next === 'affiliate') {
            setAccountThemeState(next);
        }
    }, []);

    useLayoutEffect(() => {
        applyDocumentTheme({ themeMode, accountTheme, brandColor });
        localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }, [themeMode, brandColor, accountTheme]);

    const toggleTheme = () => {
        setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
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
        setBrandColor,
        accountTheme,
        isBusinessTheme,
        isAffiliateTheme,
        setAccountTheme,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
