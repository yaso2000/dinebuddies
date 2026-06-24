/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/pages/UserProfile.jsx',
        './src/components/discovery/**/*.{js,jsx}',
        './src/pages/DiscoveryPage.jsx',
        './src/pages/DiscoveryInboxPage.jsx',
    ],
    corePlugins: {
        // Avoid resetting global PWA styles from index.css
        preflight: false,
    },
    theme: {
        extend: {
            keyframes: {
                'pill-in': {
                    '0%': { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
            },
            animation: {
                'pill-in': 'pill-in 0.35s ease-out forwards',
            },
        },
    },
    plugins: [],
};
