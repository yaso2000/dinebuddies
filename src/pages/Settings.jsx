import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';
import { FaArrowLeft, FaUser, FaEnvelope, FaLock, FaBell, FaGlobe, FaShieldAlt, FaSignOutAlt, FaTrash, FaStore, FaChevronRight, FaFileContract, FaMoon, FaSun, FaUsers } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import './Settings.css';

const Settings = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile, deleteUserAccount } = useAuth();
    const { showToast } = useToast();
    const { t, i18n } = useTranslation();
    const { isDark, toggleTheme } = useTheme();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isBusiness = userProfile?.role === 'business';

    // No redirect: show same Settings page on desktop (responsive); business uses dashboard for other things


    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
            showToast('Failed to logout. Please try again.', 'error');
        }
    };

    const handleDeleteAccount = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        try {
            setDeleting(true);
            await deleteUserAccount();
            navigate('/login');
        } catch (error) {
            console.error('Error deleting account:', error);
            showToast('Failed to delete account. Please try again.', 'error');
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const settingsSections = [
        {
            title: t('settings_account', 'Account'),
            items: [
                {
                    icon: <FaEnvelope />,
                    label: t('email', 'Email'),
                    value: currentUser?.email || 'Not set',
                    onClick: () => navigate('/settings/email'),
                    color: '#3b82f6'
                },
                {
                    icon: <FaLock />,
                    label: t('password', 'Password'),
                    value: '••••••••',
                    onClick: () => navigate('/settings/password'),
                    color: '#8b5cf6'
                }
            ]
        },
        {
            title: t('settings_preferences', 'Preferences'),
            items: [
                {
                    icon: <FaBell />,
                    label: t('notifications', 'Notifications'),
                    value: t('enabled', 'Enabled'),
                    onClick: () => navigate('/settings/notifications'),
                    color: '#f59e0b'
                },
                {
                    icon: <FaGlobe />,
                    label: t('language', 'Language'),
                    value: i18n.language === 'ar' ? 'العربية' : 'English',
                    onClick: () => navigate('/settings/language'),
                    color: '#10b981'
                },
                {
                    icon: isDark ? <FaMoon /> : <FaSun />,
                    label: t('appearance', 'Appearance'),
                    value: isDark ? t('dark_mode', 'Dark Mode') : t('light_mode', 'Light Mode'),
                    onClick: toggleTheme,
                    color: isDark ? '#8b5cf6' : '#f59e0b'
                }
            ]
        },
        {
            title: t('settings_privacy', 'Privacy & Security'),
            items: [
                {
                    icon: <FaShieldAlt />,
                    label: t('privacy_settings', 'Privacy Settings'),
                    value: t('public', 'Public'),
                    onClick: () => navigate('/settings/privacy'),
                    color: '#06b6d4'
                }
            ]
        },
        {
            title: t('settings_about', 'About & Legal'),
            items: [
                {
                    icon: <FaShieldAlt />,
                    label: t('privacy_policy', 'Privacy Policy'),
                    onClick: () => navigate('/privacy'),
                    color: '#10b981'
                },
                {
                    icon: <FaFileContract />,
                    label: t('terms_of_service', 'Terms of Service'),
                    onClick: () => navigate('/terms'),
                    color: '#3b82f6'
                },
                {
                    icon: <FaUsers />,
                    label: t('community_guidelines', 'Community Guidelines'),
                    onClick: () => navigate('/guidelines'),
                    color: '#8b5cf6'
                },
                {
                    icon: <FaTrash />,
                    label: t('account_deletion_request', 'Account Deletion Request'),
                    onClick: () => navigate('/account-deletion'),
                    color: '#ef4444'
                }
            ]
        }
    ];

    // Add Business Profile link for business accounts
    if (isBusiness) {
        settingsSections.unshift({
            title: 'Business',
            items: [
                {
                    icon: <FaStore />,
                    label: 'My Business Profile',
                    value: 'View & edit inline',
                    onClick: () => navigate(`/business/${currentUser?.uid}`),
                    color: '#f97316'
                }
            ]
        });
    }


    // Add Subscription section for business accounts (business tiers: free, professional, elite only)
    if (isBusiness) {
        const subscriptionTier = (userProfile?.subscriptionTier || 'free').toLowerCase();
        const isElite = subscriptionTier === 'elite';
        const isProfessional = subscriptionTier === 'professional';
        const isPaidBusiness = isElite || isProfessional;

        settingsSections.unshift({
            title: 'Subscription & Billing',
            items: [
                {
                    icon: isElite ? '👑' : isProfessional ? '⚡' : '📦',
                    label: 'Current Plan',
                    value: isElite ? 'Elite' : isProfessional ? 'Professional' : 'Free',
                    onClick: () => navigate('/settings/subscription'),
                    color: isElite ? '#f59e0b' : isProfessional ? '#8b5cf6' : '#6b7280',
                    badge: isPaidBusiness ? null : 'Upgrade Available'
                },
                ...(isPaidBusiness ? [{
                    icon: '💳',
                    label: 'Payment Method',
                    value: userProfile?.paymentMethod || 'Not set',
                    onClick: () => navigate('/settings/payment'),
                    color: '#8b5cf6'
                }] : []),
                ...(isPaidBusiness ? [{
                    icon: '📄',
                    label: 'Billing History',
                    value: '',
                    onClick: () => navigate('/settings/billing'),
                    color: '#10b981'
                }] : [])
            ]
        });
    }

    // Check if user is guest (unified flag)
    const isGuest = userProfile?.isGuest || false;


    // Guest View - Prompt to Sign In
    if (isGuest) {
        return (
            <div className="page-container" style={{ paddingBottom: '100px' }}>
                {/* Header */}
                <header className="app-header sticky-header-glass">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <FaArrowLeft />
                    </button>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                        ⚙️ Settings
                    </h3>
                    <div style={{ width: '40px' }}></div>
                </header>

                {/* Guest Message Card */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    padding: '2rem'
                }}>
                    <div className="ui-prompt ui-prompt--standalone" style={{
                        background: 'linear-gradient(135deg, var(--primary), var(--luxury-gold))',
                        border: 'none',
                        boxShadow: 'var(--shadow-premium)',
                        padding: '2.5rem'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👤</div>
                        <h2 className="ui-prompt__title" style={{ color: 'white', fontSize: '1.5rem' }}>
                            Guest Mode
                        </h2>
                        <p className="ui-prompt__desc" style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '2rem' }}>
                            You're browsing as a guest. Sign in to access all settings and personalize your experience!
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="ui-btn ui-btn--primary"
                            style={{ width: '100%', marginBottom: '0.75rem', background: 'white', color: 'var(--primary)' }}
                        >
                            Sign In / Sign Up
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="ui-btn ui-btn--ghost"
                            style={{ width: '100%', borderColor: 'white', color: 'white' }}
                        >
                            Continue Browsing
                        </button>
                    </div>

                    {/*Guest-only Language Setting */}
                    <div style={{
                        marginTop: '2rem',
                        width: '100%',
                        maxWidth: '400px'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            overflow: 'hidden'
                        }}>
                            <div
                                onClick={() => navigate('/settings/language')}
                                style={{
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.1rem',
                                    color: '#10b981'
                                }}>
                                    <FaGlobe />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '700', marginBottom: '2px' }}>Language</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>English</div>
                                </div>
                                <FaChevronRight style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container settings-page-responsive" style={{ paddingBottom: '100px' }}>
            {/* Responsive wrapper: same layout as mobile, centered on desktop with max-width */}
            <div className="settings-page-inner">
            {/* Minimal Header */}
            <div className="settings-header">
                <button
                    onClick={() => navigate(-1)}
                    className="settings-back-btn"
                    aria-label={t('back', 'Back')}
                >
                    <FaArrowLeft />
                </button>
                <h2 className="settings-title">Settings</h2>
            </div>

            {/* User Info Card */}
            <div className="settings-user-card">
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: getSafeAvatar(userProfile)
                        ? `url(${getSafeAvatar(userProfile)})`
                        : 'linear-gradient(135deg, var(--primary), #f97316)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '3px solid var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    color: 'white',
                    fontWeight: '800'
                }}>
                    {!getSafeAvatar(userProfile) && (
                        (userProfile?.displayName || userProfile?.display_name || 'U')[0].toUpperCase()
                    )}
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.25rem' }}>
                        {userProfile?.displayName || userProfile?.display_name || 'User'}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        {currentUser?.email}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {isBusiness && (
                            <div style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                background: 'rgba(139, 92, 246, 0.2)',
                                border: '1px solid rgba(139, 92, 246, 0.4)',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                color: 'var(--primary)'
                            }}>
                                Business Account
                            </div>
                        )}
                        {isBusiness && (userProfile?.subscriptionTier === 'elite' || userProfile?.subscriptionTier === 'professional') && (
                            <div style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                background: userProfile?.subscriptionTier === 'elite'
                                    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(249, 115, 22, 0.2))'
                                    : 'rgba(139, 92, 246, 0.2)',
                                border: `1px solid ${userProfile?.subscriptionTier === 'elite' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                color: userProfile?.subscriptionTier === 'elite' ? '#fbbf24' : 'var(--primary)'
                            }}>
                                {userProfile?.subscriptionTier === 'elite' ? '👑 Elite' : '⚡ Professional'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="settings-section">
                    <h3 className="settings-section-title">{section.title}</h3>
                    <div className="settings-section-card ui-card">
                        {section.items.map((item, itemIndex) => (
                            <div
                                key={itemIndex}
                                onClick={item.onClick}
                                style={{
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    cursor: 'pointer',
                                    borderBottom: itemIndex < section.items.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: `${item.color}15`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.1rem',
                                    color: item.color
                                }}>
                                    {item.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: '700',
                                        marginBottom: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {item.label}
                                        {item.badge && (
                                            <span style={{
                                                padding: '2px 8px',
                                                background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                                                borderRadius: '8px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                color: 'white',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.3px'
                                            }}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                    {item.value && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {item.value}
                                        </div>
                                    )}
                                </div>

                                <FaChevronRight style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Danger Zone */}
                <div className="settings-section">
                    <h3 className="settings-section-title settings-section-title--danger">Danger Zone</h3>
                    <div className="settings-section-card ui-card">
                    {/* Logout */}
                    <div
                        onClick={handleLogout}
                        style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            color: '#ef4444'
                        }}>
                            <FaSignOutAlt />
                        </div>
                        <div style={{ flex: 1, fontWeight: '700', color: '#ef4444' }}>
                            Logout
                        </div>
                        <FaChevronRight style={{ color: '#ef4444', fontSize: '0.9rem' }} />
                    </div>

                    {/* Delete Account */}
                    <div
                        onClick={handleDeleteAccount}
                        style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            color: '#ef4444'
                        }}>
                            <FaTrash />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', color: '#ef4444', marginBottom: '2px' }}>
                                {showDeleteConfirm ? 'Tap again to confirm' : 'Delete Account'}
                            </div>
                            {showDeleteConfirm && (
                                <div style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                                    This action cannot be undone
                                </div>
                            )}
                        </div>
                        {deleting ? (
                            <div style={{
                                width: '20px',
                                height: '20px',
                                border: '2px solid #ef4444',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                        ) : (
                            <FaChevronRight style={{ color: '#ef4444', fontSize: '0.9rem' }} />
                        )}
                    </div>
                </div>
            </div>

            {/* App Version */}
            <div className="settings-version">DineBuddies v1.0.0</div>
            </div>
        </div>
    );
};

export default Settings;
