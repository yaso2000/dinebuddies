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

    const wrapStyle = fullViewport
        ? {
              minHeight: '100dvh',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(160deg, #0f0817 0%, #090c1a 60%, #0d0812 100%)',
              padding: '1.5rem',
              boxSizing: 'border-box',
          }
        : {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40vh',
              width: '100%',
              padding: '1.5rem',
              boxSizing: 'border-box',
          };

    return (
        <div role="status" aria-busy="true" aria-live="polite" style={wrapStyle}>
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
}
