import React from 'react';
import { BUSINESS_PANEL_GRADIENT } from '../theme/businessAuthUi';

/**
 * Gradient border frame used for business signup/login blocks (same look as login hub).
 */
export default function BusinessAuthGradientPanel({ children, style: outerStyle = {} }) {
    return (
        <section
            style={{
                padding: 3,
                borderRadius: '18px',
                background: BUSINESS_PANEL_GRADIENT,
                ...outerStyle,
            }}
        >
            <div
                style={{
                    borderRadius: '16px',
                    background: 'var(--bg-card)',
                    padding: '1rem 0.65rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}
            >
                {children}
            </div>
        </section>
    );
}
