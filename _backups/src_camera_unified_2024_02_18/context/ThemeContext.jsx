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
    // Force dark theme always
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');

        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', '#020617');
        }
    }, []);

    const value = {
        themeMode: 'dark',
        appliedTheme: 'dark',
        isDark: true,
        // Keep setTheme for compatibility, but it does nothing
        setTheme: () => { }
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
