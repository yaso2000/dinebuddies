import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ADMIN_NAV } from '../constants';
import '../styles/shell.css';

export default function AdminShell() {
    const { t } = useTranslation();

    return (
        <div className="db-shell">
            <aside className="db-side">
                <div className="db-brand">DineBuddies · Admin</div>
                <nav className="db-nav">
                    {ADMIN_NAV.map((item) => (
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
