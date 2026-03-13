import React, { createContext, useContext, useEffect, useState } from 'react';

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

    const isDark = themeMode === 'dark';

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
        document.body.classList.toggle('light-mode', themeMode === 'light');
        localStorage.setItem(STORAGE_KEY, themeMode);

        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', themeMode === 'dark' ? '#0b0812' : '#f8fafc');
        }
    }, [themeMode]);

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
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
