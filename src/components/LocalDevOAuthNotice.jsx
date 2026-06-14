import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import {

    getLocalDevOAuthLoginUrl,

    isEmbeddedPreviewBrowser,

    isFirebaseAuthorizedDevHost,

    isLocalDevHost,

} from '../utils/localDevAuth';



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

    const setupOrigin = oauthAllowedHost ? origin : localhostLoginUrl.replace(/\/login$/, '');



    const copy = async (text) => {

        try {

            await navigator.clipboard.writeText(text);

        } catch {

            /* ignore */

        }

    };



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

                <p style={{ margin: 0, fontWeight: 800, color: '#fca5a5' }}>

                    {t(

                        'local_dev_oauth_lan_blocked',

                        'Social sign-in does not work on the network IP address.'

                    )}

                </p>

                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>

                    {t(

                        'local_dev_oauth_lan_hint',

                        'You opened {{origin}}. Firebase only allows localhost for OAuth — not 192.168.x.x.',

                        { origin }

                    )}

                </p>

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

                        'local_dev_oauth_use_localhost',

                        'Always use the Local URL from Vite (localhost), not the Network IP (192.168.x.x).'

                    )}

                </p>

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

                    onClick={() => copy(setupOrigin)}

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

                    <code style={codeStyle}>{setupOrigin}</code>

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

                    Firebase → Auth → Authorized domains:{' '}

                    <code style={{ ...codeStyle, display: 'inline' }}>localhost</code> (and{' '}

                    <code style={{ ...codeStyle, display: 'inline' }}>127.0.0.1</code> if you use it).

                    Facebook on localhost uses Firebase OAuth (not the Meta JS SDK) — same Google redirect URIs above.

                    {embeddedPreview ? (

                        <>

                            {' '}

                            {t(

                                'local_dev_oauth_cursor_hint',

                                'Cursor preview: open login in Chrome if redirect fails —'

                            )}{' '}

                            <a

                                href={localhostLoginUrl}

                                target="_blank"

                                rel="noopener noreferrer"

                                style={{ color: '#fbbf24', fontWeight: 700 }}

                            >

                                {localhostLoginUrl}

                            </a>

                        </>

                    ) : null}

                </p>

            </div>

        </details>

    );

}

