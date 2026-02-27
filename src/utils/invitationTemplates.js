// Invitation Template Configurations
// 6 Different Layout Styles × 6 Different Color Schemes = 36 Combinations

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
    classic: {
        name: 'Classic',
        emoji: '🎨',
        description: 'Traditional elegant card design',

        getStyles: (colors) => ({
            card: {
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: `2px solid ${colors.primary}`,
                boxShadow: `0 8px 24px ${colors.shadow}`,
                padding: '1.25rem'
            },
            header: {
                background: colors.gradient,
                color: 'white',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '1rem'
            },
            badge: {
                background: colors.light,
                color: colors.primary,
                border: `2px solid ${colors.primary}`,
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: '700'
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '10px',
                padding: '10px 20px',
                border: 'none',
                fontWeight: '700'
            },
            layout: {
                textAlign: 'left',
                displayDescription: true,
                titleSize: '1.4rem',
                messageStyle: { fontStyle: 'italic', opacity: 0.9 },
                showSecondaryInfo: true
            }
        })
    },

    modern: {
        name: 'Modern',
        emoji: '✨',
        description: 'Contemporary with glassmorphism',

        getStyles: (colors) => ({
            card: {
                background: `linear-gradient(135deg, ${colors.primary}10, ${colors.secondary}10)`,
                borderRadius: '24px',
                border: `1px solid ${colors.primary}30`,
                boxShadow: `0 20px 60px ${colors.shadow}`,
                padding: '1.5rem',
                backdropFilter: 'blur(10px)'
            },
            header: {
                background: `${colors.primary}15`,
                backdropFilter: 'blur(20px)',
                color: colors.primary,
                padding: '1.25rem',
                borderRadius: '18px',
                marginBottom: '1.25rem',
                border: `1px solid ${colors.primary}30`
            },
            badge: {
                background: `${colors.primary}20`,
                backdropFilter: 'blur(10px)',
                color: colors.primary,
                border: `1px solid ${colors.primary}40`,
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '0.75rem',
                fontWeight: '800'
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '16px',
                padding: '12px 24px',
                border: 'none',
                fontWeight: '800',
                boxShadow: `0 8px 24px ${colors.shadow}`
            },
            layout: {
                textAlign: 'center',
                displayDescription: true,
                titleSize: '1.6rem',
                fontFamily: "'Inter', sans-serif",
                messageStyle: { fontWeight: '400', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.9)' },
                showSecondaryInfo: true,
                accentColor: colors.primary,
                backgroundOverlay: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0l20 20M20 0L0 20\' stroke=\'%23f59e0b\' stroke-opacity=\'0.05\' stroke-width=\'1\'/%3E%3C/svg%3E")'
            }
        })
    },

    elegant: {
        name: 'Romantic',
        emoji: '🌹',
        description: 'Luxurious with rose and gold accents',

        getStyles: (colors) => ({
            card: {
                background: colors.gradient || `linear-gradient(135deg, var(--bg-card), ${colors.light})`,
                borderRadius: '30px',
                border: `2px solid ${colors.primary}`,
                boxShadow: `0 0 30px ${colors.shadow}`,
                padding: '1.5rem',
                position: 'relative',
                color: 'white'
            },
            header: {
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, var(--luxury-gold))`,
                color: 'white',
                padding: '1.5rem',
                borderRadius: '20px',
                marginBottom: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
            },
            badge: {
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: `1.5px solid rgba(255,255,255,0.4)`,
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '0.75rem',
                fontWeight: '700',
                backdropFilter: 'blur(5px)'
            },
            button: {
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, var(--luxury-gold))`,
                color: 'white',
                borderRadius: '30px',
                padding: '12px 28px',
                border: 'none',
                fontWeight: '800',
                boxShadow: `0 8px 24px ${colors.shadow}`
            },
            layout: {
                textAlign: 'center',
                displayDescription: true,
                titleSize: '2.2rem',
                fontFamily: "'Inter', sans-serif",
                messageStyle: { fontSize: '1.2rem', fontStyle: 'italic', fontWeight: '400', letterSpacing: '0.2px', color: '#D4AF37' },
                showSecondaryInfo: false,
                backgroundOverlay: 'none'
            }
        })
    },

    fun: {
        name: 'Family',
        emoji: '🌳',
        description: 'Warm, friendly and welcoming',

        getStyles: (colors) => ({
            card: {
                background: `linear-gradient(to bottom right, ${colors.light}20, var(--bg-card))`,
                borderRadius: '25px',
                border: `3px solid ${colors.primary}40`,
                boxShadow: `0 10px 30px ${colors.shadow}`,
                padding: '1.5rem'
            },
            header: {
                background: colors.gradient,
                color: 'white',
                padding: '1.25rem',
                borderRadius: '20px',
                marginBottom: '1.25rem'
            },
            badge: {
                background: colors.primary,
                color: 'white',
                borderRadius: '12px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '700'
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '18px',
                padding: '14px 24px',
                border: 'none',
                fontWeight: '700',
                boxShadow: `0 6px 15px ${colors.shadow}`
            },
            layout: {
                textAlign: 'left',
                displayDescription: true,
                titleSize: '1.6rem',
                fontFamily: "'Outfit', sans-serif",
                messageStyle: { fontWeight: '500', color: 'var(--text-main)', opacity: '0.9' },
                showSecondaryInfo: true,
                decorativeElement: '👨‍👩‍👧‍👦',
                backgroundOverlay: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 10c0-5-5-5-5 0s5 5 5 5 5-5 5-5-5 0-5 0z\' fill=\'%2310b981\' fill-opacity=\'0.03\'/%3E%3C/svg%3E")'
            }
        })
    },

    minimal: {
        name: 'Minimal',
        emoji: '⚪',
        description: 'Clean and simple',

        getStyles: (colors) => ({
            card: {
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: `1px solid var(--border-color)`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                padding: '1.25rem'
            },
            header: {
                background: 'transparent',
                color: colors.primary,
                padding: '0.75rem 0',
                borderBottom: `2px solid ${colors.primary}`,
                marginBottom: '1rem'
            },
            badge: {
                background: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.7rem',
                fontWeight: '600'
            },
            button: {
                background: colors.primary,
                color: 'white',
                borderRadius: '8px',
                padding: '10px 20px',
                border: 'none',
                fontWeight: '600'
            },
            layout: {
                textAlign: 'left',
                displayDescription: false,
                titleSize: '1.2rem',
                fontFamily: "'Inter', sans-serif",
                messageStyle: {},
                showSecondaryInfo: true
            }
        })
    },

    premium: {
        name: 'Business',
        emoji: '👔',
        description: 'Elite corporate professional',

        getStyles: (colors) => ({
            card: {
                background: `linear-gradient(135deg, #0f172a, #1e293b)`,
                borderRadius: '16px',
                border: `1px solid ${colors.primary}50`,
                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5)`,
                padding: '2rem',
                overflow: 'hidden'
            },
            header: {
                background: `rgba(255,255,255,0.05)`,
                color: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.75rem',
                textAlign: 'center',
                borderBottom: `3px solid ${colors.primary}`
            },
            badge: {
                background: 'transparent',
                color: colors.primary,
                border: `1.5px solid ${colors.primary}`,
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '0.7rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '1.5px'
            },
            button: {
                background: colors.primary,
                color: 'white',
                borderRadius: '4px',
                padding: '14px 32px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.95rem',
                textTransform: 'uppercase',
                letterSpacing: '1px'
            },
            layout: {
                textAlign: 'center',
                displayDescription: true,
                titleSize: '1.8rem',
                fontFamily: "'Montserrat', sans-serif",
                messageStyle: { fontWeight: '600', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.8)' },
                showSecondaryInfo: true,
                decorativeElement: '💼',
                backgroundOverlay: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\'/%3E%3Cpath d=\'M0 20h40M20 0v40\' stroke=\'%23ffffff\' stroke-opacity=\'0.03\' stroke-width=\'1\'/%3E%3C/svg%3E")'
            }
        })
    }
};

export const OCCASION_PRESETS = {
    Dating: {
        templateType: 'elegant',
        colorScheme: 'royalRed',
        lottieUrl: 'https://assets9.lottiefiles.com/packages/lf20_m6cu961l.json' // Romantic Heart
    },
    Birthday: {
        templateType: 'fun',
        colorScheme: 'sunsetOrange',
        lottieUrl: 'https://assets5.lottiefiles.com/packages/lf20_u4j3cx7u.json' // Confetti
    },
    Social: {
        templateType: 'modern',
        colorScheme: 'leafGreen',
        lottieUrl: 'https://assets10.lottiefiles.com/packages/lf20_o6spyj.json' // Social Network
    },
    Work: {
        templateType: 'premium',
        colorScheme: 'royalPurple',
        lottieUrl: 'https://assets3.lottiefiles.com/packages/lf20_vnikbeve.json' // Office/Work
    },
    Nightlife: {
        templateType: 'modern',
        colorScheme: 'midnightGold',
        lottieUrl: 'https://assets2.lottiefiles.com/packages/lf20_myej9j9j.json' // Nightlife/Party
    },
    Dining: {
        templateType: 'elegant',
        colorScheme: 'oceanBlue',
        lottieUrl: 'https://assets4.lottiefiles.com/packages/lf20_06m8n5.json' // Dining/Food
    },
    Café: {
        templateType: 'classic',
        colorScheme: 'sunsetOrange',
        lottieUrl: 'https://assets2.lottiefiles.com/packages/lf20_ytp7shm2.json' // Coffee
    },
    Gaming: {
        templateType: 'fun',
        colorScheme: 'slateBlue',
        lottieUrl: 'https://assets5.lottiefiles.com/packages/lf20_5njpkv83.json' // Gaming
    }
};

export const getTemplateStyle = (templateType, colorScheme, occasionType) => {
    // If occasionType is provided and a preset exists, use it
    const normalizedOccasion = (occasionType || '').charAt(0).toUpperCase() + (occasionType || '').slice(1).toLowerCase();
    if (normalizedOccasion && OCCASION_PRESETS[normalizedOccasion]) {
        const preset = OCCASION_PRESETS[normalizedOccasion];
        const template = TEMPLATE_STYLES[preset.templateType] || TEMPLATE_STYLES.modern;
        const colors = COLOR_SCHEMES[preset.colorScheme] || COLOR_SCHEMES.oceanBlue;
        return template.getStyles(colors);
    }

    // Fallback to manual selection or defaults
    const template = TEMPLATE_STYLES[templateType] || TEMPLATE_STYLES.classic;
    const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.oceanBlue;
    return template.getStyles(colors);
};
