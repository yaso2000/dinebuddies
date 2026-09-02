import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ADMIN_NAV } from '../constants';
import { useAuth } from '../../context/AuthContext';
import { filterAdminNav, getAdminRegion } from '../../utils/adminAccess';
import '../styles/shell.css';

export default function AdminShell() {
    const { t } = useTranslation();
    const { userProfile } = useAuth();

    const nav = filterAdminNav(ADMIN_NAV, userProfile);
    const region = getAdminRegion(userProfile);

    return (
        <div className="db-shell">
            <aside className="db-side">
                <div className="db-brand">DineBuddies · Admin</div>
                {region ? (
                    <div className="db-region-badge" title={t('admin_region_scope_note', 'You manage this region only')}>
                        🌍 {t(region.labelKey, region.defaultLabel)}
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
            <main className="db-main">
                <Outlet />
            </main>
        </div>
    );
}
