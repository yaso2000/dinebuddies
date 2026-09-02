import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ADMIN_NAV } from '../constants';
import { useAuth } from '../../context/AuthContext';
import {
    ADMIN_OWNER_ONLY_PATHS,
    ADMIN_REGION_LIST,
    ADMIN_REGIONS,
    filterAdminNav,
    getAdminRegion,
    isRegionalManager,
} from '../../utils/adminAccess';
import { getViewAsRegion, setViewAsRegion, subscribeViewAsRegion } from '../viewAsRegion';
import { adminApi } from '../api';
import '../styles/shell.css';

export default function AdminShell() {
    const { t } = useTranslation();
    const { userProfile } = useAuth();

    const region = getAdminRegion(userProfile);

    // Owner / full admin may "act as" a region to supervise a manager's view.
    // Regional managers are locked to their own region and get no switcher.
    const canViewAsRegion = !isRegionalManager(userProfile);
    const [viewRegion, setViewRegion] = React.useState(getViewAsRegion());
    React.useEffect(() => subscribeViewAsRegion(setViewRegion), []);

    // Record this admin-panel entry (audit + owner alert on a new manager device).
    React.useEffect(() => {
        adminApi.logAdminAccess().catch(() => {});
    }, []);
    const activeView = canViewAsRegion ? ADMIN_REGIONS[viewRegion] : null;

    // While impersonating, mirror the manager's exact menu (hide owner-only tools).
    let nav = filterAdminNav(ADMIN_NAV, userProfile);
    if (activeView) nav = nav.filter((item) => !ADMIN_OWNER_ONLY_PATHS.has(item.path));

    return (
        <div className="db-shell">
            <aside className="db-side">
                <div className="db-brand">DineBuddies · Admin</div>

                {region ? (
                    <div
                        className="db-region-badge"
                        title={t('admin_region_scope_note', 'You manage this region only')}
                    >
                        🌍 {t(region.labelKey, region.defaultLabel)}
                    </div>
                ) : null}

                {canViewAsRegion ? (
                    <div className="db-view-as">
                        <label className="db-view-as__label" htmlFor="db-view-as-select">
                            👁 {t('admin_view_as_label', 'اعرض كـ')}
                        </label>
                        <select
                            id="db-view-as-select"
                            className="db-select db-view-as__select"
                            value={viewRegion}
                            onChange={(e) => setViewAsRegion(e.target.value)}
                        >
                            <option value="">🌍 {t('admin_view_as_all', 'كل المناطق')}</option>
                            {ADMIN_REGION_LIST.map((r) => (
                                <option key={r.key} value={r.key}>
                                    {r.emoji} {t(r.labelKey, r.defaultLabel)}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}

                <nav className="db-nav">
                    {nav.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => (isActive ? 'active' : undefined)}
                        >
                            {t(item.labelKey)}
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Remount routed pages when the acting region changes so they refetch. */}
            <main className="db-main" key={activeView ? viewRegion : 'all'}>
                {activeView ? (
                    <div className="db-viewas-banner">
                        <span>
                            👁 {t('admin_view_as_banner', 'تعرض الآن كمدير إقليمي')} —{' '}
                            <strong>
                                {activeView.emoji} {t(activeView.labelKey, activeView.defaultLabel)}
                            </strong>
                            . {t('admin_view_as_banner_note', 'العرض والإجراءات محصورة بهذه المنطقة.')}
                        </span>
                        <button
                            type="button"
                            className="db-btn db-btn--ghost"
                            onClick={() => setViewAsRegion('')}
                        >
                            {t('admin_view_as_exit', 'عودة للعرض الكلي')}
                        </button>
                    </div>
                ) : null}
                <Outlet />
            </main>
        </div>
    );
}
