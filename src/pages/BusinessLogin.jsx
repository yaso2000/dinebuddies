import React from 'react';
import BusinessLoginPanel from './auth/BusinessLoginPanel';

/**
 * Standalone business-only full-page login (optional route). Prefer {@link LoginHub} for the unified experience.
 */
export default function BusinessLogin() {
    return (
        <div
            className="auth-route-scroll business-auth-page"
            style={{
                background: 'var(--bg-body-gradient, var(--bg-body))',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'clamp(1rem, 4vh, 2rem) 1rem',
                boxSizing: 'border-box',
            }}
        >
            <BusinessLoginPanel />
        </div>
    );
}
