import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isEmbeddedPreviewBrowser } from '../utils/localDevAuth';

/**
 * Collapsible dev-only OAuth checklist — exact origins for this session (e.g. :5177 if :5176 is busy).
 */
export default function LocalDevOAuthNotice() {
    const { t } = useTranslation();

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
    const codeStyle = { color: 'var(--text-main)', wordBreak: 'break-all', display: 'block', marginTop: 4 };

    const copy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            /* ignore */
        }
    };

    return (
        <details
            className="local-dev-oauth-notice"
            style={{
                marginBottom: '1rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '12px',
                fontSize: '0.72rem',
                lineHeight: 1.5,
                color: 'var(--text-main)',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
        >
            <summary
                style={{
                    cursor: 'pointer',
                    fontWeight: 800,
                    color: '#fbbf24',
                    listStyle: 'none',
                }}
            >
                {t(
                    'local_dev_oauth_summary',
                    'Local dev: OAuth setup (expand if sign-in fails)'
                )}
            </summary>
            <div style={{ marginTop: '0.65rem' }}>
                <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_body',
                        'Google Cloud → Credentials → Web client → add these values (use the exact origin below — port may be 5176 or 5177):'
                    )}
                </p>
                <p style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Authorized JavaScript origins
                </p>
                <button
                    type="button"
                    onClick={() => copy(origin)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'start',
                        width: '100%',
                    }}
                    title={t('copy', 'Copy')}
                >
                    <code style={codeStyle}>{origin}</code>
                </button>
                <p style={{ margin: '0.65rem 0 0.25rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Authorized redirect URIs
                </p>
                {redirectUris.map((uri) => (
                    <button
                        key={uri}
                        type="button"
                        onClick={() => copy(uri)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'start',
                            width: '100%',
                        }}
                        title={t('copy', 'Copy')}
                    >
                        <code style={codeStyle}>{uri}</code>
                    </button>
                ))}
                <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)' }}>
                    Firebase → Auth → Authorized domains: <code style={{ ...codeStyle, display: 'inline' }}>localhost</code>.
                    {embeddedPreview ? (
                        <>
                            {' '}
                            {t(
                                'local_dev_oauth_cursor_hint',
                                'Cursor preview: open login in Chrome if redirect fails —'
                            )}{' '}
                            <a
                                href={`${origin}/login`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#fbbf24', fontWeight: 700 }}
                            >
                                {origin}/login
                            </a>
                        </>
                    ) : null}
                </p>
            </div>
        </details>
    );
}
