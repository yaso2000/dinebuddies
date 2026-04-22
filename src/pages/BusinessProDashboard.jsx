import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import {
    FaChartBar, FaUsers, FaComments, FaPaintBrush, FaCog,
    FaBell, FaHome, FaArrowLeft, FaEnvelope, FaCrown, FaCommentDots, FaStore, FaInbox
} from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useNotifications } from '../context/NotificationContext';
import { useChat } from '../context/ChatContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useTranslation } from 'react-i18next';

import ProOverview from './business-pro/ProOverview';
import ProOffers from './business-pro/ProOffers';
import ProMembers from './business-pro/ProMembers';
import ProMessages from './business-pro/ProMessages';
import ProDesignStudio from './business-pro/ProDesignStudio';
import ProSettings from './business-pro/ProSettings';
import ProNotifications from './business-pro/ProNotifications';
import ProDirectMessages from './business-pro/ProDirectMessages';
import ProSubscription from './business-pro/ProSubscription';
import ProFeaturedPost from './business-pro/ProFeaturedPost';
import ProDrafts from './business-pro/ProDrafts';
import ProEventPost from './business-pro/ProEventPost';
import HelpSupport from './HelpSupport';
import BusinessFeedbackInbox from '../components/BusinessFeedbackInbox';
import { FaBookmark, FaStar, FaCalendarAlt, FaQuestionCircle } from 'react-icons/fa';

import './BusinessProDashboard.css';
import EmailVerificationBusinessBanner from '../components/EmailVerificationBusinessBanner';
import { needsEmailPasswordVerification } from '../utils/emailVerification';

const NAV_ITEMS = [
    { key: 'overview', label: 'Overview', icon: <FaChartBar />, group: 'main' },
    { key: 'members', label: 'Members', icon: <FaUsers />, group: 'main' },
    { key: 'messages', label: 'Community Chat', icon: <FaComments />, group: 'main' },
    { key: 'dm', label: 'Direct Messages', icon: <FaEnvelope />, group: 'main' },
    { key: 'inbox', label: 'Inbox', icon: <FaInbox />, group: 'main' },
    { key: 'notifs', label: 'Notifications', icon: <FaBell />, group: 'main' },
    { key: 'design', label: 'Design Studio', icon: <FaPaintBrush />, group: 'tools' },
    { key: 'featured', label: 'New Featured Post', icon: <FaStar />, group: 'tools' },
    { key: 'event', label: 'New Event Post', icon: <FaCalendarAlt />, group: 'tools' },
    { key: 'drafts', label: 'My Library', icon: <FaBookmark />, group: 'tools' },
    { key: 'subscription', label: 'Subscription', icon: <FaCrown />, group: 'tools' },
    { key: 'settings', label: 'Settings', icon: <FaCog />, group: 'tools' },
    { key: 'support', label: 'Help & Support', icon: <FaQuestionCircle />, group: 'tools' },
];

const SECTION_TITLES = {
    overview:     { title: 'Overview',              subtitle: 'Your community at a glance' },
    members:      { title: 'Community Members',      subtitle: 'People who joined your community' },
    messages:     { title: 'Community Chat',         subtitle: 'Communicate with your members' },
    dm:           { title: 'Direct Messages',        subtitle: 'Private conversations' },
    inbox:        { title: 'Feedback Inbox',         subtitle: 'Manage customer complaints and suggestions' },
    notifs:       { title: 'Notifications',          subtitle: 'Your latest activity' },
    design:       { title: 'Design Studio',          subtitle: 'Create visuals for your brand' },
    featured:     { title: 'New Featured Post',      subtitle: 'Create and publish an elite slide to the feed' },
    event:        { title: 'New Event Post',         subtitle: 'Promote an upcoming event to your community' },
    drafts:       { title: 'Studio Vault',           subtitle: 'Your saved posts, offers, reports and prints' },
    subscription: { title: 'Subscription',           subtitle: 'Manage your partner plan and billing' },
    settings:     { title: 'Settings',               subtitle: 'Account and business preferences' },
    support:      { title: 'Help & Support',         subtitle: 'Find answers and learn how to use the dashboard' },
};

const BusinessProDashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile, isGuest, loading } = useAuth();
    const { unreadCount } = useNotifications();
    const { unreadCount: chatUnread } = useChat();
    const [activeSection, setActiveSection] = useState('overview');
    const [editOfferData, setEditOfferData] = useState(null);
    const [editingFeaturedPost, setEditingFeaturedPost] = useState(null);
    const [editingEventPost, setEditingEventPost] = useState(null);
    const [designTool, setDesignTool] = useState(null);

    // Immediate guards: never render dashboard for guest or non-business (no flash of content)
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-body)' }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }
    if (!currentUser || isGuest) {
        return <Navigate to="/business/login" replace />;
    }
    if (needsEmailPasswordVerification(currentUser, userProfile)) {
        return <Navigate to="/verify-email" replace />;
    }
    if (userProfile && !userProfile.isBusiness) {
        return <Navigate to="/" replace />;
    }

    // Navigate to a section, optionally with extra params (e.g. { editOffer, tool })
    const handleNavigate = (section, params = {}) => {
        setEditOfferData(params.editOffer || null);
        setDesignTool(params.tool || null);
        setActiveSection(section);
    };

    // Auto-open design studio if arrived with openDesign, or subscription tab, or Social Creator
    useEffect(() => {
        const state = location.state;
        const searchParams = new URLSearchParams(location.search);
        const editId = searchParams.get('edit');

        // 1. Direct URL navigation (e.g. from bookmark, email, or stale feed)
        if (location.pathname.includes('/featured-post') && editId) {
            getDoc(doc(db, 'featured_posts', editId)).then(snap => {
                if (snap.exists()) {
                    setEditingFeaturedPost({ id: snap.id, ...snap.data() });
                    setActiveSection('featured');
                    window.history.replaceState({}, '', '/business-pro');
                }
            });
        } else if (location.pathname.includes('/event-post') && editId) {
            getDoc(doc(db, 'communityPosts', editId)).then(snap => {
                if (snap.exists()) {
                    setEditingEventPost({ id: snap.id, ...snap.data() });
                    setActiveSection('event');
                    window.history.replaceState({}, '', '/business-pro');
                }
            });
        }
        // 2. React Router state navigation (from our updated PostsFeed / PostCard)
        else if (state?.openDesign) {
            setEditOfferData(state.editOffer || null);
            setActiveSection('design');
            window.history.replaceState({}, '');
        } else if (state?.defaultTab) {
            if (state.editPost) setEditingFeaturedPost(state.editPost);
            if (state.editEvent) setEditingEventPost(state.editEvent);
            setActiveSection(state.defaultTab);
            window.history.replaceState({}, '');
        }
    }, [location]);

    // Guard: redirect if not a business account (avoid "/" — HomeRouter redirects business users and felt like a loop)
    useEffect(() => {
        if (userProfile && !userProfile.isBusiness) {
            navigate('/posts-feed', { replace: true });
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
            case 'overview':  return <ProOverview />;
            case 'offers':    return <ProOffers onNavigate={handleNavigate} />;
            case 'members':   return <ProMembers />;
            case 'messages':  return <ProMessages />;
            case 'dm':        return <ProDirectMessages />;
            case 'inbox':     return <BusinessFeedbackInbox />;
            case 'notifs':    return <ProNotifications />;
            case 'design':    return <ProDesignStudio editOffer={editOfferData} defaultTool={designTool} />;
            case 'featured':  return (
                <ProFeaturedPost
                    editingPost={editingFeaturedPost}
                    onSuccess={() => { setEditingFeaturedPost(null); setActiveSection('drafts'); }}
                    onBack={() => { setEditingFeaturedPost(null); setActiveSection('drafts'); }}
                />
            );
            case 'event': return (
                <ProEventPost
                    editingEvent={editingEventPost}
                    onSuccess={() => { setEditingEventPost(null); setActiveSection('drafts'); }}
                    onBack={() => { setEditingEventPost(null); setActiveSection('drafts'); }}
                />
            );
            case 'drafts':    return (
                <ProDrafts
                    onNewPost={() => { setEditingFeaturedPost(null); setActiveSection('featured'); }}
                    onEditPost={(post) => { setEditingFeaturedPost(post); setActiveSection('featured'); }}
                    onNewEvent={() => { setEditingEventPost(null); setActiveSection('event'); }}
                    onEditEvent={(ev) => { setEditingEventPost(ev); setActiveSection('event'); }}
                    onNavigate={handleNavigate}
                />
            );
            case 'subscription': return <ProSubscription />;
            case 'settings':  return <ProSettings />;
            case 'support':   return <HelpSupport isDashboard={true} />;
            default:          return <ProOverview />;
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
                    onClick={() => currentUser && navigate(`/business/${currentUser.uid}?preview=1`)}
                >
                    <span className="bpro-nav-icon"><FaStore /></span>
                    {t('profile_title', 'My Profile')}
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
                            referrerPolicy="no-referrer"
                            onError={e => { 
                                if (e.target.dataset.error) return; 
                                e.target.dataset.error = true;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=7c3aed&color=fff`; 
                            }}
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
                <EmailVerificationBusinessBanner />
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
                            referrerPolicy="no-referrer"
                            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(167,139,250,0.4)', cursor: 'pointer' }}
                            onClick={() => setActiveSection('settings')}
                            onError={e => { 
                                if (e.target.dataset.error) return; 
                                e.target.dataset.error = true;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=7c3aed&color=fff`; 
                            }}
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
