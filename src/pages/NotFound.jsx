import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Shown for unknown paths (no matching <Route />). Also helps debug “blank” screens.
 */
const NotFound = () => {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <div
            className="auth-route-scroll"
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px',
                background: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontFamily: 'var(--font-body)',
                textAlign: 'center',
                gap: 16,
            }}
        >
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                {t('page_not_found_title', 'Page not found')}
            </h1>
            <p style={{ margin: 0, maxWidth: 420, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {t(
                    'page_not_found_hint',
                    'This link may be wrong or the page has moved. Check the address or open the home screen.'
                )}
            </p>
            <code
                style={{
                    fontSize: '0.8rem',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    wordBreak: 'break-all',
                }}
            >
                {location.pathname}
            </code>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                <Link
                    to="/"
                    className="ui-btn ui-btn--primary"
                    style={{ padding: '12px 20px', borderRadius: 14, fontWeight: 800, textDecoration: 'none' }}
                >
                    {t('nav_home', 'Home')}
                </Link>
                <Link
                    to="/login"
                    className="ui-btn ui-btn--secondary"
                    style={{ padding: '12px 20px', borderRadius: 14, fontWeight: 800, textDecoration: 'none', display: 'inline-block' }}
                >
                    {t('nav_login', 'Login')}
                </Link>
                <Link
                    to="/posts-feed"
                    style={{
                        padding: '12px 20px',
                        borderRadius: 14,
                        fontWeight: 700,
                        color: 'var(--primary)',
                        textDecoration: 'underline',
                    }}
                >
                    {t('feed_header', 'Feed')}
                </Link>
            </div>
        </div>
    );
};

export default NotFound;
