import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UserManagement from './UserManagement';
import BusinessManagement from './BusinessManagement';
import { FaUser, FaStore, FaUsersCog } from 'react-icons/fa';

const VALID_TABS = new Set(['consumers', 'business', 'team']);

const AccountsManager = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabRaw = searchParams.get('tab') || 'consumers';
    const tab = VALID_TABS.has(tabRaw) ? tabRaw : 'consumers';

    const setTab = (next) => {
        setSearchParams({ tab: next }, { replace: true });
    };

    const tabs = [
        { id: 'consumers', label: t('admin_accounts_tab_consumers'), icon: FaUser },
        { id: 'business', label: t('admin_accounts_tab_business'), icon: FaStore },
        { id: 'team', label: t('admin_accounts_tab_team'), icon: FaUsersCog },
    ];

    return (
        <div>
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">{t('admin_accounts_title')}</h1>
                <p className="admin-page-subtitle">{t('admin_accounts_subtitle')}</p>
            </div>

            <div className="admin-card admin-mb-4" style={{ padding: '0.5rem' }}>
                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap' }}>
                    {tabs.map((x) => (
                        <button
                            key={x.id}
                            type="button"
                            onClick={() => setTab(x.id)}
                            className="admin-btn"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: tab === x.id ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'transparent',
                                color: tab === x.id ? '#ffffff' : '#94a3b8',
                                border: tab === x.id ? 'none' : '1px solid #334155',
                                flex: '1 1 140px',
                                justifyContent: 'center',
                            }}
                        >
                            <x.icon />
                            {x.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'consumers' && <UserManagement accountScope="consumer" />}
            {tab === 'business' && <BusinessManagement embedded />}
            {tab === 'team' && <UserManagement accountScope="team" />}
        </div>
    );
};

export default AccountsManager;
