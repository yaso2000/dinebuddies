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
            }
        })
    },

    elegant: {
        name: 'Elegant',
        emoji: '👑',
        description: 'Luxurious with gold accents',

        getStyles: (colors) => ({
            card: {
                background: 'var(--bg-card)',
                borderRadius: '20px',
                border: `3px solid ${colors.primary}`,
                boxShadow: `0 12px 40px ${colors.shadow}, inset 0 0 0 1px rgba(255, 215, 0, 0.2)`,
                padding: '1.5rem',
                position: 'relative'
            },
            header: {
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, #ffd700)`,
                color: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                marginBottom: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
            },
            badge: {
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))',
                color: colors.primary,
                border: `2px solid ${colors.primary}`,
                borderRadius: '12px',
                padding: '8px 16px',
                fontSize: '0.7rem',
                fontWeight: '800',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
            },
            button: {
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, #ffd700)`,
                color: 'white',
                borderRadius: '12px',
                padding: '12px 28px',
                border: '2px solid rgba(255, 215, 0, 0.3)',
                fontWeight: '800',
                boxShadow: `0 8px 24px ${colors.shadow}`
            }
        })
    },

    fun: {
        name: 'Fun',
        emoji: '🎉',
        description: 'Playful and colorful',

        getStyles: (colors) => ({
            card: {
                background: `radial-gradient(circle at top left, ${colors.light}, var(--bg-card))`,
                borderRadius: '28px',
                border: `4px dashed ${colors.primary}`,
                boxShadow: `0 16px 48px ${colors.shadow}, 0 0 0 8px ${colors.light}`,
                padding: '1.75rem',
                position: 'relative'
            },
            header: {
                background: colors.gradient,
                color: 'white',
                padding: '1.5rem',
                borderRadius: '20px 20px 0 0',
                marginBottom: '1.25rem',
                transform: 'rotate(-1deg)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
            },
            badge: {
                background: colors.gradient,
                color: 'white',
                border: `3px solid white`,
                borderRadius: '25px',
                padding: '10px 18px',
                fontSize: '0.8rem',
                fontWeight: '900',
                textTransform: 'uppercase',
                boxShadow: `0 4px 12px ${colors.shadow}`,
                transform: 'rotate(2deg)'
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '25px',
                padding: '14px 32px',
                border: `3px solid white`,
                fontWeight: '900',
                fontSize: '1.05rem',
                boxShadow: `0 8px 24px ${colors.shadow}`,
                transform: 'scale(1.05)'
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
            }
        })
    },

    premium: {
        name: 'Premium',
        emoji: '💎',
        description: 'VIP exclusive style',

        getStyles: (colors) => ({
            card: {
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.8)), linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}20)`,
                borderRadius: '24px',
                border: `2px solid ${colors.primary}`,
                boxShadow: `0 24px 72px ${colors.shadow}, inset 0 0 40px ${colors.primary}10`,
                padding: '2rem',
                position: 'relative',
                overflow: 'hidden'
            },
            header: {
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                color: 'white',
                padding: '1.75rem',
                borderRadius: '18px',
                marginBottom: '1.75rem',
                textAlign: 'center',
                boxShadow: `0 12px 36px ${colors.shadow}, inset 0 0 20px rgba(255, 255, 255, 0.1)`,
                border: `1px solid ${colors.primary}`
            },
            badge: {
                background: colors.gradient,
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '20px',
                padding: '10px 18px',
                fontSize: '0.75rem',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: `0 8px 24px ${colors.shadow}, inset 0 0 10px rgba(255, 255, 255, 0.1)`
            },
            button: {
                background: colors.gradient,
                color: 'white',
                borderRadius: '14px',
                padding: '14px 32px',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                fontWeight: '900',
                fontSize: '1rem',
                boxShadow: `0 12px 36px ${colors.shadow}, inset 0 0 10px rgba(255, 255, 255, 0.1)`,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }
        })
    }
};

export const getTemplateStyle = (templateType, colorScheme) => {
    const template = TEMPLATE_STYLES[templateType] || TEMPLATE_STYLES.classic;
    const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.oceanBlue;
    return template.getStyles(colors);
};
