import React from 'react';

/**
 * PlanBadge — inline badge showing which subscription tier unlocks a feature.
 * Usage:
 *   <PlanBadge tier="pro" />     → ⚡ PRO  (purple)
 *   <PlanBadge tier="elite" />   → 👑 ELITE (gold)
 */
const PlanBadge = ({ tier = 'pro', style = {} }) => {
    const isPro = tier === 'pro';

    const base = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 7px',
        borderRadius: '6px',
        fontSize: '0.65rem',
        fontWeight: '800',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        verticalAlign: 'middle',
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
        ...style,
    };

    if (isPro) {
        return (
            <span style={{
                ...base,
                background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
                color: 'white',
                boxShadow: '0 2px 8px rgba(109,40,217,0.4)',
            }}>
                ⚡ Pro
            </span>
        );
    }

    return (
        <span style={{
            ...base,
            background: '#000000',
            color: '#f59e0b',
            border: '1.5px solid #f59e0b',
            boxShadow: '0 0 6px rgba(245,158,11,0.5)',
        }}>
            👑 Elite
        </span>
    );
};

export default PlanBadge;
