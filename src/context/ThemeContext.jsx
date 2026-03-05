import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    // App is permanently dark — no light mode
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#020617');
    }, []);

    const value = {
        themeMode: 'dark',
        isDark: true,
        toggleTheme: () => { }, // no-op — kept for backward compat
        setTheme: () => { },    // no-op
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
