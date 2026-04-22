// Invitation Template Configurations
// Three full-bleed photo layouts (bottom bar / glass panel / chips) × color schemes.

export const COLOR_SCHEMES = {
    oceanBlue: {
        name: 'Ocean Blue',
        emoji: '🌊',
        primary: '#3b82f6',
        secondary: '#1d4ed8',
        light: '#dbeafe',
        gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        shadow: 'rgba(59, 130, 246, 0.3)'
    },
    sunsetOrange: {
        name: 'Sunset Orange',
        emoji: '🌅',
        primary: '#f59e0b',
        secondary: '#d97706',
        light: '#fef3c7',
        gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
        shadow: 'rgba(245, 158, 11, 0.3)'
    },
    natureGreen: {
        name: 'Nature Green',
        emoji: '🌿',
        primary: '#10b981',
        secondary: '#059669',
        light: '#d1fae5',
        gradient: 'linear-gradient(135deg, #10b981, #059669)',
        shadow: 'rgba(16, 185, 129, 0.3)'
    },
    royalPurple: {
        name: 'Royal Purple',
        emoji: '👑',
        primary: '#a855f7',
        secondary: '#7c3aed',
        light: '#ede9fe',
        gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
        shadow: 'rgba(168, 85, 247, 0.3)'
    },
    passionateRed: {
        name: 'Passionate Red',
        emoji: '❤️',
        primary: '#ef4444',
        secondary: '#dc2626',
        light: '#fee2e2',
        gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
        shadow: 'rgba(239, 68, 68, 0.3)'
    },
    sweetPink: {
        name: 'Sweet Pink',
        emoji: '💗',
        primary: '#ec4899',
        secondary: '#db2777',
        light: '#fce7f3',
        gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
        shadow: 'rgba(236, 72, 153, 0.3)'
    },
    midnightGold: {
        name: 'Midnight Gold',
        emoji: '✨',
        primary: '#D4AF37', // Gold
        secondary: '#0F172A', // Navy
        light: '#1e293b',
        gradient: 'linear-gradient(135deg, #0F172A, #1e293b)',
        shadow: 'rgba(212, 175, 55, 0.4)'
    },
    royalRed: {
        name: 'Royal Red',
        emoji: '🍷',
        primary: '#8b0000', // Dark Red
        secondary: '#4a0000', // Deeper Red
        light: '#ffc1c1',
        gradient: 'linear-gradient(135deg, #8b0000, #4a0000)',
        shadow: 'rgba(139, 0, 0, 0.4)'
    },
    leafGreen: {
        name: 'Leaf Green',
        emoji: '🌿',
        primary: '#10b981',
        secondary: '#059669',
        light: '#d1fae5',
        gradient: 'linear-gradient(135deg, #10b981, #059669)',
        shadow: 'rgba(16, 185, 129, 0.3)'
    },
    slateBlue: {
        name: 'Slate Blue',
        emoji: '🎮',
        primary: '#6366f1',
        secondary: '#4f46e5',
        light: '#e0e7ff',
        gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        shadow: 'rgba(99, 102, 241, 0.3)'
    }
};

export const TEMPLATE_STYLES = {
    photoBottom: {
        name: 'Bottom focus',
        emoji: '\u{1F4CD}',
        description: 'Title on the image; details along the bottom',

        getStyles: (colors) => ({
            card: {
                background: 'transparent',
                borderRadius: '24px',
                border: 'none',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
            },
            header: {
                background: 'transparent',
                color: '#ffffff',
                padding: 0,
                marginBottom: 0,
            },
            badge: {
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '12px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: '800',
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '14px',
                padding: '12px 20px',
                border: 'none',
                fontWeight: '800',
                boxShadow: `0 10px 28px ${colors.shadow}`,
            },
            layout: {
                cardVariant: 'photoBottom',
                textAlign: 'left',
                displayDescription: true,
                titleSize: '1.35rem',
                fontFamily: "'Inter', system-ui, sans-serif",
                messageStyle: { color: 'rgba(255,255,255,0.92)', fontWeight: '500' },
                showSecondaryInfo: true,
                accentColor: colors.primary,
            },
        }),
    },

    photoGlass: {
        name: 'Glass panel',
        emoji: '\u{2728}',
        description: 'Frosted glass card for date, time, and details',

        getStyles: (colors) => ({
            card: {
                background: 'transparent',
                borderRadius: '24px',
                border: 'none',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
            },
            header: {
                background: 'transparent',
                color: '#ffffff',
                padding: 0,
                marginBottom: 0,
            },
            badge: {
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '12px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: '800',
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '14px',
                padding: '12px 20px',
                border: 'none',
                fontWeight: '800',
                boxShadow: `0 10px 28px ${colors.shadow}`,
            },
            layout: {
                cardVariant: 'photoGlass',
                textAlign: 'center',
                displayDescription: true,
                titleSize: '1.4rem',
                fontFamily: "'Inter', system-ui, sans-serif",
                messageStyle: { color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
                showSecondaryInfo: true,
                accentColor: colors.primary,
            },
        }),
    },

    photoChips: {
        name: 'Chips',
        emoji: '\u{1F3F7}\u{FE0F}',
        description: 'Compact pills for date, guests, payment, and distance',

        getStyles: (colors) => ({
            card: {
                background: 'transparent',
                borderRadius: '24px',
                border: 'none',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
            },
            header: {
                background: 'transparent',
                color: '#ffffff',
                padding: 0,
                marginBottom: 0,
            },
            badge: {
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '12px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: '800',
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '14px',
                padding: '12px 20px',
                border: 'none',
                fontWeight: '800',
                boxShadow: `0 10px 28px ${colors.shadow}`,
            },
            layout: {
                cardVariant: 'photoChips',
                textAlign: 'center',
                displayDescription: true,
                titleSize: '1.4rem',
                fontFamily: "'Inter', system-ui, sans-serif",
                messageStyle: { color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
                showSecondaryInfo: true,
                accentColor: colors.primary,
            },
        }),
    },
};

export const LEGACY_PUBLIC_TEMPLATE_MAP = {
    classic: 'photoBottom',
    modern: 'photoGlass',
    elegant: 'photoChips',
    fun: 'photoBottom',
    minimal: 'photoGlass',
    premium: 'photoChips',
    fullCanvas: 'photoBottom',
    editorial: 'photoGlass',
};

/**
 * Show all prepared templates in the picker (legacy + current).
 * Legacy keys are mapped at render-time by getTemplateStyle().
 */
export const TEMPLATE_PICKER_KEYS = [
    // Real distinct layouts only (avoid multiple names for same visual structure)
    'classic',      // Header + body
    'fullCanvas',   // Full-bleed
    'photoBottom',
    'photoGlass',
    'photoChips',
];

export const OCCASION_PRESETS = {
    Birthday: {
        templateType: 'photoBottom',
        colorScheme: 'sunsetOrange',
        lottieUrl: 'https://assets5.lottiefiles.com/packages/lf20_u4j3cx7u.json' // Confetti
    },
    Social: {
        templateType: 'photoGlass',
        colorScheme: 'leafGreen',
        lottieUrl: 'https://assets10.lottiefiles.com/packages/lf20_o6spyj.json' // Social Network
    },
    Work: {
        templateType: 'photoChips',
        colorScheme: 'royalPurple',
        lottieUrl: 'https://assets3.lottiefiles.com/packages/lf20_vnikbeve.json' // Office/Work
    },
    Nightlife: {
        templateType: 'photoGlass',
        colorScheme: 'midnightGold',
        lottieUrl: 'https://assets2.lottiefiles.com/packages/lf20_myej9j9j.json' // Nightlife/Party
    },
    Dining: {
        templateType: 'photoChips',
        colorScheme: 'oceanBlue',
        lottieUrl: 'https://assets4.lottiefiles.com/packages/lf20_06m8n5.json' // Dining/Food
    },
    Café: {
        templateType: 'photoBottom',
        colorScheme: 'sunsetOrange',
        lottieUrl: 'https://assets2.lottiefiles.com/packages/lf20_ytp7shm2.json' // Coffee
    },
    Gaming: {
        templateType: 'photoBottom',
        colorScheme: 'slateBlue',
        lottieUrl: 'https://assets5.lottiefiles.com/packages/lf20_5njpkv83.json' // Gaming
    },
    Family: {
        templateType: 'photoGlass',
        colorScheme: 'natureGreen',
        emoji: '\u{1F46A}',
        lottieUrl: 'https://assets3.lottiefiles.com/packages/lf20_cjqtkpjm.json' // Family/Home
    },
    Celebration: {
        templateType: 'photoChips',
        colorScheme: 'midnightGold',
        emoji: '\u{1F389}',
        lottieUrl: 'https://assets2.lottiefiles.com/packages/lf20_obhph3t0.json' // Celebration/Fireworks
    },
    Cinema: {
        templateType: 'photoGlass',
        colorScheme: 'royalPurple',
        emoji: '\u{1F37F}',
        lottieUrl: 'https://assets2.lottiefiles.com/packages/lf20_6s1bndto.json' // Cinema/Popcorn/Movies
    },
    Sports: {
        templateType: 'photoBottom',
        colorScheme: 'oceanBlue',
        emoji: '\u{1F3C6}',
        lottieUrl: 'https://assets5.lottiefiles.com/packages/lf20_jmz1a7.json' // Sports
    },
    Bbq: {
        templateType: 'photoChips',
        colorScheme: 'sunsetOrange',
        emoji: '\u{1F525}',
        lottieUrl: 'https://assets4.lottiefiles.com/packages/lf20_06m8n5.json' // Food/BBQ
    }
};

export const getTemplateStyle = (templateType, colorScheme, occasionType) => {
    const mapped = LEGACY_PUBLIC_TEMPLATE_MAP[templateType] || templateType;
    const template = TEMPLATE_STYLES[mapped] || TEMPLATE_STYLES.photoBottom;
    const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.oceanBlue;
    return template.getStyles(colors);
};
