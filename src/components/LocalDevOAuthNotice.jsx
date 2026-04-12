import React from 'react';

/**
 * Shown only in Vite dev on localhost — explains why Google/Facebook may fail until consoles are configured.
 */
export default function LocalDevOAuthNotice() {
    if (!import.meta.env.DEV) return null;
    if (typeof window === 'undefined') return null;
    const { hostname, origin } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;

    return (
        <div
            style={{
                marginBottom: '1rem',
                padding: '0.75rem 0.85rem',
                borderRadius: '12px',
                fontSize: '0.72rem',
                lineHeight: 1.45,
                color: 'var(--text-main)',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
        >
            <strong style={{ display: 'block', marginBottom: '0.35rem', color: '#fbbf24' }}>
                Local dev — Google / Facebook
            </strong>
            <span style={{ color: 'var(--text-muted)' }}>
                Add <code style={{ color: 'var(--text-main)' }}>{origin}</code> to{' '}
                <strong>Google Cloud</strong> → OAuth Web client → Authorized JavaScript origins; keep Firebase redirect URIs{' '}
                (<code>…firebaseapp.com/__/auth/handler</code>). In <strong>Firebase</strong> → Auth → Authorized domains, include{' '}
                <code>localhost</code>. For <strong>Facebook</strong>, Meta app → Facebook Login → add valid OAuth redirect URIs / site URL for this origin.
            </span>
        </div>
    );
}
