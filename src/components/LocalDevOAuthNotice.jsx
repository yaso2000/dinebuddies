import React, { useMemo } from 'react';
import { isEmbeddedPreviewBrowser } from '../utils/localDevAuth';

/**
 * Shown only in Vite dev on localhost — exact Google / Firebase OAuth URLs for this project.
 */
export default function LocalDevOAuthNotice() {
    if (!import.meta.env.DEV) return null;
    if (typeof window === 'undefined') return null;
    const { hostname, origin } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;

    const authDomain =
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
        `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies'}.firebaseapp.com`;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies';

    const redirectUris = useMemo(
        () => [
            `https://${authDomain}/__/auth/handler`,
            `https://${projectId}.web.app/__/auth/handler`,
        ],
        [authDomain, projectId]
    );

    const embeddedPreview = isEmbeddedPreviewBrowser();

    const codeStyle = { color: 'var(--text-main)', wordBreak: 'break-all' };

    return (
        <div
            style={{
                marginBottom: '1rem',
                padding: '0.75rem 0.85rem',
                borderRadius: '12px',
                fontSize: '0.72rem',
                lineHeight: 1.5,
                color: 'var(--text-main)',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
        >
            <strong style={{ display: 'block', marginBottom: '0.35rem', color: '#fbbf24' }}>
                Local dev — إعداد Google OAuth (redirect_uri_mismatch)
            </strong>
            <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
                Firebase Console → Authentication → Sign-in method → Google → انسخ <strong>Web client ID</strong>.
                في Google Cloud → Credentials → نفس العميل (Web application):
            </p>
            <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>
                <strong>Authorized JavaScript origins</strong> — أضف:
            </p>
            <code style={codeStyle}>{origin}</code>
            <p style={{ margin: '0.65rem 0 0.35rem', color: 'var(--text-muted)' }}>
                <strong>Authorized redirect URIs</strong> — أضف بالضبط:
            </p>
            {redirectUris.map((uri) => (
                <div key={uri}>
                    <code style={codeStyle}>{uri}</code>
                </div>
            ))}
            <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)' }}>
                Firebase → Auth → Authorized domains: <code style={codeStyle}>localhost</code>.
                {embeddedPreview ? (
                    <>
                        {' '}
                        أنت في <strong>معاينة Cursor</strong> — Google يستخدم redirect. إن فشل،{' '}
                        <a
                            href={`${origin}/login`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#fbbf24', fontWeight: 700 }}
                        >
                            افتح /login في Chrome
                        </a>
                        .
                    </>
                ) : (
                    ' في Chrome العادي Google يستخدم popup.'
                )}
            </p>
        </div>
    );
}
