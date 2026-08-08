import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getFirebaseOAuthRedirectUris,
    getLocalDevOAuthJavascriptOrigins,
    getLocalDevOAuthLoginUrl,
    getLocalDevPort,
    isEmbeddedPreviewBrowser,
    isFirebaseAuthorizedDevHost,
    isLocalDevHost,
} from '../utils/localDevAuth';
import { AppText } from './base';

/**
 * Collapsible dev-only OAuth checklist — exact origins for this session (e.g. :5177 if :5176 is busy).
 */
export default function LocalDevOAuthNotice() {
    const { t } = useTranslation();

    if (!import.meta.env.DEV) return null;
    if (typeof window === 'undefined') return null;

    const { hostname, origin } = window.location;
    const oauthAllowedHost = isFirebaseAuthorizedDevHost();
    const localhostLoginUrl = getLocalDevOAuthLoginUrl();

    if (!isLocalDevHost() && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies';
    const authDomain =
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;

    const javascriptOrigins = useMemo(() => {
        const current = getLocalDevOAuthJavascriptOrigins(getLocalDevPort());
        if (oauthAllowedHost && origin && !current.includes(origin)) {
            return [origin, ...current];
        }
        return current;
    }, [oauthAllowedHost, origin]);

    const redirectUris = useMemo(
        () => getFirebaseOAuthRedirectUris(projectId, authDomain),
        [authDomain, projectId]
    );

    if (!oauthAllowedHost) {
        return (
            <div
                className="local-dev-oauth-notice local-dev-oauth-notice--blocked"
                style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    lineHeight: 1.55,
                    color: 'var(--text-main)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                }}
            >
                <AppText as="p" style={{ margin: 0, fontWeight: 800, color: '#fca5a5' }}>
                    {t(
                        'local_dev_oauth_lan_blocked',
                        'Social sign-in does not work on the network IP address.'
                    )}
                </AppText>
                <AppText as="p" style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_lan_hint',
                        'You opened {{origin}}. Firebase only allows localhost for OAuth — not 192.168.x.x.',
                        { origin }
                    )}
                </AppText>
                <a
                    href={localhostLoginUrl}
                    style={{
                        display: 'inline-block',
                        marginTop: '0.65rem',
                        color: '#fbbf24',
                        fontWeight: 800,
                        wordBreak: 'break-all',
                    }}
                >
                    {localhostLoginUrl}
                </a>
            </div>
        );
    }

    const embeddedPreview = isEmbeddedPreviewBrowser();
    const codeStyle = { color: 'var(--text-main)', wordBreak: 'break-all', display: 'block', marginTop: 4 };
    const googleCredentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${projectId}`;
    const firebaseGoogleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;

    const copy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            /* ignore */
        }
    };

    if (embeddedPreview) {
        return (
            <div
                className="local-dev-oauth-notice local-dev-oauth-notice--preview"
                style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    lineHeight: 1.55,
                    color: 'var(--text-main)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                }}
            >
                <AppText as="p" style={{ margin: 0, fontWeight: 800, color: '#93c5fd' }}>
                    {t(
                        'local_dev_oauth_preview_title',
                        'Cursor preview cannot complete Google sign-in.'
                    )}
                </AppText>
                <AppText as="p" style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_preview_body',
                        'Use the button below to open login in Chrome. Sign in there — it will not carry over to this preview tab.'
                    )}
                </AppText>
                <a
                    href={localhostLoginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-block',
                        marginTop: '0.65rem',
                        color: '#60a5fa',
                        fontWeight: 800,
                        wordBreak: 'break-all',
                    }}
                >
                    {localhostLoginUrl}
                </a>
            </div>
        );
    }

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
                    'Local dev: Google sign-in setup (expand if sign-in fails)'
                )}
            </summary>
            <div style={{ marginTop: '0.65rem' }}>
                <AppText as="p" style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_use_localhost',
                        'Open Chrome at the Local URL from Vite (localhost), not the Network IP (192.168.x.x).'
                    )}
                </AppText>
                <AppText as="p" style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_google_step1',
                        '1) Firebase → Authentication → Google → Enabled. Copy the Web client ID from Web SDK configuration:'
                    )}{' '}
                    <a href={firebaseGoogleUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fbbf24' }}>
                        {t('local_dev_oauth_open_firebase', 'Open Firebase Google settings')}
                    </a>
                </AppText>
                <AppText as="p" style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_google_step2',
                        '2) Google Cloud → Credentials → that Web client → add every origin below (port may be 5176 or 5177):'
                    )}{' '}
                    <a href={googleCredentialsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fbbf24' }}>
                        {t('local_dev_oauth_open_gcloud', 'Open Google Cloud Credentials')}
                    </a>
                </AppText>
                <AppText as="p" style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Authorized JavaScript origins
                </AppText>
                {javascriptOrigins.map((jsOrigin) => (
                    <button
                        key={jsOrigin}
                        type="button"
                        onClick={() => copy(jsOrigin)}
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
                        <code style={codeStyle}>{jsOrigin}</code>
                    </button>
                ))}
                <AppText as="p" style={{ margin: '0.65rem 0 0.25rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Authorized redirect URIs
                </AppText>
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
                <AppText as="p" style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)' }}>
                    {t(
                        'local_dev_oauth_firebase_domains',
                        'Firebase → Auth → Authorized domains: add localhost and 127.0.0.1 if missing. Then run: npm run deploy:firebase-auth'
                    )}
                </AppText>
            </div>
        </details>
    );
}
