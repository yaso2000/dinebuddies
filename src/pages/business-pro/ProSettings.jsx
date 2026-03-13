import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
    FaUser, FaBell, FaLock, FaCreditCard, FaSignOutAlt, FaChevronRight,
    FaStore, FaGlobe, FaMoon, FaSun, FaShieldAlt, FaFileContract, FaTrash, FaExternalLinkAlt, FaUsers
} from 'react-icons/fa';

// Import inline settings panels (desktop-optimised)
import ProAccountSettings from './ProAccountSettings';
import NotificationsSettings from '../NotificationsSettings';
import PrivacySettings from '../PrivacySettings';
import BillingSettings from '../BillingSettings';

const NAV_ITEMS = [
    { key: 'business', label: 'Business Profile', desc: 'Edit your listing and business info', icon: <FaStore />, color: 'orange' },
    { key: 'account', label: 'Account Settings', desc: 'Email, password, and personal details', icon: <FaUser />, color: 'blue' },
    { key: 'notifications', label: 'Notifications', desc: 'Control how and when you get alerts', icon: <FaBell />, color: 'orange' },
    { key: 'privacy', label: 'Privacy & Security', desc: 'Manage who can see your data', icon: <FaLock />, color: 'green' },
    { key: 'billing', label: 'Billing & Subscription', desc: 'Manage your plan and payment methods', icon: <FaCreditCard />, color: 'purple' },
    { key: 'language', label: 'Language', desc: 'Change the app display language', icon: <FaGlobe />, color: 'teal' },
    { key: 'appearance', label: 'Appearance', desc: 'Dark mode and display settings', icon: <FaMoon />, color: 'purple' },
    { key: 'legal', label: 'About & Legal', desc: 'Privacy policy & terms of service', icon: <FaShieldAlt />, color: 'green' },
];

/* ── Small inline panels for items that don't need a full subpage ── */

const BusinessPanel = ({ navigate, userId }) => (
    <div style={{ padding: '8px 0' }}>
        <h3 style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 8 }}>Business Profile</h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: 20 }}>
            View and manage your business profile as customers see it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
                onClick={() => navigate(`/business/${userId}`)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 20px', borderRadius: 12,
                    background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
                    color: '#f97316', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                    width: '100%', transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.12)'}
            >
                <FaStore />
                View Business Profile
                <FaExternalLinkAlt style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }} />
            </button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: 10 }}>
            Opens your public business profile page.
        </p>
    </div>
);

const LanguagePanel = ({ i18n }) => {
    const langs = [
        { code: 'en', label: 'English', flag: '🇦🇺' },
        { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    ];
    return (
        <div style={{ padding: '8px 0' }}>
            <h3 style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 8 }}>Language</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: 20 }}>
                Choose your preferred display language.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {langs.map(l => (
                    <button
                        key={l.code}
                        onClick={() => i18n.changeLanguage(l.code)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '13px 18px', borderRadius: 12,
                            background: i18n.language === l.code ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
                            border: i18n.language === l.code ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.06)',
                            color: i18n.language === l.code ? '#a78bfa' : '#f1f5f9',
                            fontWeight: i18n.language === l.code ? 700 : 500, fontSize: '0.9rem',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        <span style={{ fontSize: '1.3rem' }}>{l.flag}</span>
                        {l.label}
                        {i18n.language === l.code && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓ Active</span>}
                    </button>
                ))}
            </div>
        </div>
    );
};

const AppearancePanel = ({ isDark, toggleTheme }) => (
    <div style={{ padding: '8px 0' }}>
        <h3 style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 8 }}>Appearance</h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: 20 }}>
            Switch between light and dark mode.
        </p>
        <button
            onClick={toggleTheme}
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px', borderRadius: 12, width: '100%',
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                color: '#a78bfa', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
        >
            {isDark ? <FaMoon style={{ fontSize: '1.1rem' }} /> : <FaSun style={{ fontSize: '1.1rem' }} />}
            {isDark ? 'Dark Mode (active)' : 'Light Mode (active)'}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.6 }}>Click to toggle</span>
        </button>
    </div>
);

const LegalPanel = ({ navigate }) => (
    <div style={{ padding: '8px 0' }}>
        <h3 style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 8 }}>About & Legal</h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: 20 }}>
            DineBuddies v1.0.0
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
                { label: 'Privacy Policy', icon: <FaShieldAlt />, path: '/privacy' },
                { label: 'License Agreement & Terms of Use', icon: <FaFileContract />, path: '/terms' },
                { label: 'Community Guidelines', icon: <FaUsers />, path: '/guidelines' },
                { label: 'Account Deletion Request', icon: <FaTrash />, path: '/account-deletion' },
            ].map(item => (
                <button
                    key={item.path}
                    type="button"
                    className="ui-btn ui-btn--ghost"
                    onClick={() => navigate(item.path)}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '13px 18px', gap: 12 }}
                >
                    <span style={{ color: '#10b981' }}>{item.icon}</span>
                    {item.label}
                    <FaExternalLinkAlt style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.4 }} />
                </button>
            ))}
        </div>
    </div>
);

/* ── Main Component ── */
const ProSettings = () => {
    const [activeKey, setActiveKey] = useState('account');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();
    const { deleteUserAccount, currentUser } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const { i18n } = useTranslation();

    const handleSignOut = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleDeleteAccount = async () => {
        if (!showDeleteConfirm) { setShowDeleteConfirm(true); return; }
        try {
            setDeleting(true);
            await deleteUserAccount();
            navigate('/login');
        } catch {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const renderPanel = () => {
        const wrapStyle = { flex: 1, overflowY: 'auto', minWidth: 0 };
        switch (activeKey) {
            case 'business': return <div style={wrapStyle}><BusinessPanel navigate={navigate} userId={currentUser?.uid} /></div>;
            case 'account': return <div style={wrapStyle}><ProAccountSettings /></div>;
            case 'notifications': return <div style={wrapStyle}><NotificationsSettings /></div>;
            case 'privacy': return <div style={wrapStyle}><PrivacySettings /></div>;
            case 'billing': return <div style={wrapStyle}><BillingSettings /></div>;
            case 'language': return <div style={wrapStyle}><LanguagePanel i18n={i18n} /></div>;
            case 'appearance': return <div style={wrapStyle}><AppearancePanel isDark={isDark} toggleTheme={toggleTheme} /></div>;
            case 'legal': return <div style={wrapStyle}><LegalPanel navigate={navigate} /></div>;
            default: return <div style={wrapStyle}><ProAccountSettings /></div>;
        }
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: 0 }}>
            {/* Hide mobile-style back buttons and headers inside embedded pages */}
            <style>{`
                .bpro-settings-panel .back-btn,
                .bpro-settings-panel .settings-header .back-btn,
                .bpro-settings-panel [class*="back-btn"],
                .bpro-settings-panel button[class*="back"] {
                    display: none !important;
                }
                .bpro-settings-panel .settings-header,
                .bpro-settings-panel .notification-settings-page > .settings-header {
                    padding-left: 0 !important;
                }
            `}</style>

            {/* ===== LEFT LIST ===== */}
            <div style={{
                width: 280, minWidth: 280,
                display: 'flex', flexDirection: 'column', gap: 4,
                paddingRight: 20,
                borderRight: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>Settings</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>Manage account and preferences</div>
                </div>

                {NAV_ITEMS.map(item => (
                    <button
                        key={item.key}
                        onClick={() => setActiveKey(item.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 14px', borderRadius: 12,
                            background: activeKey === item.key ? 'rgba(167,139,250,0.12)' : 'transparent',
                            border: activeKey === item.key ? '1px solid rgba(167,139,250,0.2)' : '1px solid transparent',
                            cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { if (activeKey !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (activeKey !== item.key) e.currentTarget.style.background = 'transparent'; }}
                    >
                        <div className={`bpro-stat-icon ${item.color}`} style={{ width: 36, height: 36, borderRadius: 9, fontSize: '0.9rem', flexShrink: 0 }}>
                            {item.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: activeKey === item.key ? '#a78bfa' : '#f1f5f9', transition: 'color 0.2s' }}>
                                {item.label}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.desc}
                            </div>
                        </div>
                        <FaChevronRight style={{ color: activeKey === item.key ? '#a78bfa' : 'rgba(255,255,255,0.2)', fontSize: '0.75rem', flexShrink: 0 }} />
                    </button>
                ))}

                {/* ── Danger Zone ── */}
                <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Sign Out */}
                    <button
                        type="button"
                        className="ui-btn ui-btn--danger-outline"
                        onClick={handleSignOut}
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px', gap: 12, fontSize: '0.875rem' }}
                    >
                        <FaSignOutAlt />
                        Sign Out
                    </button>

                    {/* Delete Account */}
                    <button
                        type="button"
                        className="ui-btn ui-btn--danger-outline"
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        style={{
                            width: '100%', justifyContent: 'flex-start', padding: '12px 14px', gap: 12, fontSize: '0.8rem',
                            background: showDeleteConfirm ? 'rgba(239,68,68,0.2)' : undefined,
                            opacity: deleting ? 0.6 : 1,
                            cursor: deleting ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <FaTrash style={{ fontSize: '0.8rem' }} />
                        {deleting ? 'Deleting…' : showDeleteConfirm ? 'Tap again to confirm' : 'Delete Account'}
                    </button>
                </div>
            </div>

            {/* ===== RIGHT PANEL ===== */}
            <div className="bpro-settings-panel" style={{ flex: 1, overflowY: 'auto', paddingLeft: 28, minWidth: 0 }}>
                {renderPanel()}
            </div>
        </div>
    );
};

export default ProSettings;
