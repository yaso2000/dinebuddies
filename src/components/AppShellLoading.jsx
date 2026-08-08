import React from 'react';
import { useTranslation } from 'react-i18next';
import AppRouteLoading from './AppRouteLoading';

/**
 * Keeps desktop 3-column shell visible while auth/session loads — avoids narrow dark flash.
 */
export default function AppShellLoading({ variant = 'session' }) {
    const { i18n } = useTranslation();
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';

    return (
        <div className="app-layout app-layout--booting" dir={dir}>
            <header className="app-header app-header--boot-placeholder" aria-hidden="true">
                <div className="logo-wrapper">
                    <img src="/db-logo.svg" alt="" className="app-logo-img" />
                </div>
            </header>
            <div className="ds-body-grid">
                <aside className="ds-left-sidebar app-shell-sidebar-placeholder" aria-hidden="true" />
                <main className="app-main app-main--shell-loading">
                    <AppRouteLoading variant={variant} />
                </main>
                <aside className="ds-right-sidebar app-shell-sidebar-placeholder" aria-hidden="true" />
            </div>
        </div>
    );
}
