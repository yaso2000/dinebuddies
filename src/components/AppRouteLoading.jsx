import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Unified loading shell for route lazy-load, auth/session wait, and profile hydrate.
 * Avoids silent spinners that feel like errors or infinite hangs.
 */
export default function AppRouteLoading({ variant = 'route', fullViewport = false }) {
    const { t } = useTranslation();
    const title =
        variant === 'session'
            ? t('loading_app_session', 'Preparing your session…')
            : variant === 'profile'
              ? t('loading_app_profile', 'Syncing your profile…')
              : t('loading_app_route', 'Loading…');

    const wrapClass = ['app-route-loading', fullViewport ? 'app-route-loading--full' : 'app-route-loading--inline'].join(' ');

    const inner = (
        <div role="status" aria-busy="true" aria-live="polite" className={wrapClass}>
            <div
                style={{
                    width: 44,
                    height: 44,
                    border: '4px solid rgba(148, 163, 184, 0.15)',
                    borderTopColor: 'var(--primary, #E86E2E)',
                    borderRadius: '50%',
                    animation: 'spin 0.9s linear infinite',
                    flexShrink: 0,
                }}
            />
            <p
                style={{
                    marginTop: '1rem',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    maxWidth: '280px',
                    lineHeight: 1.45,
                }}
            >
                {title}
            </p>
        </div>
    );

    if (fullViewport) {
        return (
            <div className="app-loading-shell">
                <div className="app-loading-shell__grid">
                    <div className="app-loading-shell__rail app-loading-shell__rail--left" aria-hidden />
                    <div className="app-loading-shell__main">{inner}</div>
                    <div className="app-loading-shell__rail app-loading-shell__rail--right" aria-hidden />
                </div>
            </div>
        );
    }

    return inner;
}
