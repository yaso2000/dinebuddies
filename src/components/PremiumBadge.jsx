import React from 'react';
import { FaCrown, FaLock } from 'react-icons/fa';

/**
 * A small badge to indicate a premium feature.
 * @param {string} mode - 'pro' (crown) or 'locked' (lock icon) 
 * @param {boolean} isPaid - if true, the badge can optionally be hidden or restyled (usually hidden by the parent though)
 */
const PremiumBadge = ({ mode = 'pro', text = 'PRO' }) => {
    if (mode === 'locked') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                color: '#fbbf24',
                padding: '2px 6px', borderRadius: '6px',
                fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px',
                marginLeft: '6px', verticalAlign: 'middle'
            }}>
                <FaLock size={8} /> {text}
            </span>
        );
    }

    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: '#000000',
            color: '#f59e0b',
            padding: '2px 6px', borderRadius: '6px',
            fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px',
            marginLeft: '6px', verticalAlign: 'middle',
            border: '1.5px solid #f59e0b',
            boxShadow: '0 0 6px rgba(245,158,11,0.4)'
        }}>
            <FaCrown size={10} /> {text}
        </span>
    );
};

export default PremiumBadge;
