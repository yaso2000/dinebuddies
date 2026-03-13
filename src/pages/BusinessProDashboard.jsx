import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import {
    FaChartBar, FaGift, FaUsers, FaComments, FaPaintBrush, FaCog,
    FaBell, FaHome, FaArrowLeft, FaEnvelope, FaCrown, FaCommentDots, FaStore
} from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useNotifications } from '../context/NotificationContext';
import { useChat } from '../context/ChatContext';

import ProOverview from './business-pro/ProOverview';
import ProOffers from './business-pro/ProOffers';
import ProMembers from './business-pro/ProMembers';
import ProMessages from './business-pro/ProMessages';
import ProDesignStudio from './business-pro/ProDesignStudio';
import ProSettings from './business-pro/ProSettings';
import ProNotifications from './business-pro/ProNotifications';
import ProDirectMessages from './business-pro/ProDirectMessages';
import ProSubscription from './business-pro/ProSubscription';

import './BusinessProDashboard.css';

const NAV_ITEMS = [
    { key: 'overview', label: 'Overview', icon: <FaChartBar />, group: 'main' },
    { key: 'offers', label: 'Offers', icon: <FaGift />, group: 'main' },
    { key: 'members', label: 'Members', icon: <FaUsers />, group: 'main' },
    { key: 'messages', label: 'Community Chat', icon: <FaComments />, group: 'main' },
    { key: 'dm', label: 'Direct Messages', icon: <FaEnvelope />, group: 'main' },
    { key: 'notifs', label: 'Notifications', icon: <FaBell />, group: 'main' },
    { key: 'design', label: 'Design Studio', icon: <FaPaintBrush />, group: 'tools' },
    { key: 'subscription', label: 'Subscription', icon: <FaCrown />, group: 'tools' },
    { key: 'settings', label: 'Settings', icon: <FaCog />, group: 'tools' },
];

const SECTION_TITLES = {
    overview: { title: 'Overview', subtitle: 'Your community at a glance' },
    offers: { title: 'Manage Offers', subtitle: 'Create and manage dining invitations' },
    members: { title: 'Community Members', subtitle: 'People who joined your community' },
    messages: { title: 'Community Chat', subtitle: 'Communicate with your members' },
    dm: { title: 'Direct Messages', subtitle: 'Private conversations' },
    notifs: { title: 'Notifications', subtitle: 'Your latest activity' },
    design: { title: 'Design Studio', subtitle: 'Create visuals for your brand' },
    subscription: { title: 'Subscription', subtitle: 'Manage your partner plan and billing' },
    settings: { title: 'Settings', subtitle: 'Account and business preferences' },
};

const BusinessProDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile } = useAuth();
    const { unreadCount } = useNotifications();
    const { unreadCount: chatUnread } = useChat();
    const [activeSection, setActiveSection] = useState('overview');
    const [editOfferData, setEditOfferData] = useState(null);

    // Navigate to a section, optionally with extra params (e.g. { editOffer })
    const handleNavigate = (section, params = {}) => {
        setEditOfferData(params.editOffer || null);
        setActiveSection(section);
    };

    // Auto-open design studio if arrived from mobile with openDesign state
    // OR auto-open subscription if arrived with defaultTab: 'subscription'
    useEffect(() => {
        const state = location.state;
        if (state?.openDesign) {
            setEditOfferData(state.editOffer || null);
            setActiveSection('design');
            window.history.replaceState({}, '');
        } else if (state?.defaultTab) {
            setActiveSection(state.defaultTab);
            window.history.replaceState({}, '');
        }
    }, []);

    // Guard: redirect if not a business account
    useEffect(() => {
        if (userProfile && !userProfile.isBusiness) {
            navigate('/');
        }
    }, [userProfile, navigate]);

    // Guard: only Elite can use the dedicated desktop dashboard. Single source: users.subscriptionTier (free, professional, elite only).
    const tier = (userProfile?.subscriptionTier || 'free').toLowerCase();
    const isElite = tier === 'elite';
    useEffect(() => {
        if (!currentUser || !userProfile) return;
        if (!userProfile.isBusiness) return;
        if (!isElite) {
            navigate('/business-dashboard', { replace: true });
        }
    }, [currentUser, userProfile, isElite, navigate]);

    // Don't render desktop dashboard for Free/Pro (redirect in progress)
    if (userProfile?.isBusiness && currentUser && !isElite) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    // Guard: redirect to mobile dashboard on small screens
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) navigate('/business-dashboard');
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [navigate]);

    const renderSection = () => {
        switch (activeSection) {
            case 'overview': return <ProOverview />;
            case 'offers': return <ProOffers onNavigate={handleNavigate} />;
            case 'members': return <ProMembers />;
            case 'messages': return <ProMessages />;
            case 'dm': return <ProDirectMessages />;
            case 'notifs': return <ProNotifications />;
            case 'design': return <ProDesignStudio editOffer={editOfferData} />;
            case 'subscription': return <ProSubscription />;
            case 'settings': return <ProSettings />;
            default: return <ProOverview />;
        }
    };

    const mainNav = NAV_ITEMS.filter(n => n.group === 'main');
    const toolsNav = NAV_ITEMS.filter(n => n.group === 'tools');
    const { title, subtitle } = SECTION_TITLES[activeSection] || {};
    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';

    return (
        <div className="bpro-root">
            {/* ===== SIDEBAR ===== */}
            <aside className="bpro-sidebar">
                {/* Logo */}
                <div className="bpro-sidebar-logo">
                    <HiBuildingStorefront style={{ fontSize: 28, color: '#a78bfa' }} />
                    <div>
                        <div className="bpro-sidebar-logo-text">DineBuddies</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Business Pro</div>
                    </div>
                </div>

                {/* Home link at top */}
                <button className="bpro-nav-item" style={{ marginBottom: 4 }} onClick={() => navigate('/')}>
                    <span className="bpro-nav-icon"><FaHome /></span>
                    Home
                </button>

                {/* My Profile */}
                <button
                    className="bpro-nav-item"
                    style={{ marginBottom: 8, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}
                    onClick={() => currentUser && navigate(`/business/${currentUser.uid}`)}
                >
                    <span className="bpro-nav-icon"><FaStore /></span>
                    My Profile
                </button>

                {/* Main Nav */}
                <div className="bpro-sidebar-nav">
                    <div className="bpro-sidebar-label">Main</div>
                    {mainNav.map(item => (
                        <button
                            key={item.key}
                            className={`bpro-nav-item ${activeSection === item.key ? 'active' : ''}`}
                            onClick={() => handleNavigate(item.key)}
                        >
                            <span className="bpro-nav-icon">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}

                    <div className="bpro-sidebar-label" style={{ marginTop: 8 }}>Tools</div>
                    {toolsNav.map(item => (
                        <button
                            key={item.key}
                            className={`bpro-nav-item ${activeSection === item.key ? 'active' : ''}`}
                            onClick={() => handleNavigate(item.key)}
                        >
                            <span className="bpro-nav-icon">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* User Footer */}
                <div className="bpro-sidebar-footer">
                    <div className="bpro-sidebar-user" onClick={() => setActiveSection('settings')}>
                        <img
                            src={getSafeAvatar(userProfile)}
                            alt={businessName}
                            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=7c3aed&color=fff`; }}
                        />
                        <div className="bpro-sidebar-user-info">
                            <div className="bpro-sidebar-user-name">{businessName}</div>
                            <div className="bpro-sidebar-user-role">Business Account</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ===== MAIN AREA ===== */}
            <main className="bpro-main">
                {/* Header */}
                <header className="bpro-header">
                    <div>
                        <div className="bpro-header-title">{title}</div>
                        <div className="bpro-header-subtitle">{subtitle}</div>
                    </div>
                    <div className="bpro-header-actions">
                        <button className="bpro-header-btn" onClick={() => setActiveSection('dm')} title="Messages" style={{ position: 'relative' }}>
                            <FaCommentDots />
                            {chatUnread > 0 && (
                                <span className="bpro-header-btn-badge">{chatUnread > 9 ? '9+' : chatUnread}</span>
                            )}
                        </button>
                        <button className="bpro-header-btn" onClick={() => setActiveSection('notifs')} title="Notifications">
                            <FaBell />
                            {unreadCount > 0 && (
                                <span className="bpro-header-btn-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>
                        <button className="bpro-header-btn" onClick={() => navigate('/business-dashboard')} title="Mobile View">
                            <FaArrowLeft />
                        </button>
                        <img
                            src={getSafeAvatar(userProfile)}
                            alt={businessName}
                            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(167,139,250,0.4)', cursor: 'pointer' }}
                            onClick={() => setActiveSection('settings')}
                        />
                    </div>
                </header>

                {/* Content */}
                <div className="bpro-content">
                    {renderSection()}
                </div>
            </main>
        </div>
    );
};

export default BusinessProDashboard;
