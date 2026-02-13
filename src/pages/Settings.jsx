import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';
import { FaArrowLeft, FaUser, FaEnvelope, FaLock, FaBell, FaGlobe, FaShieldAlt, FaSignOutAlt, FaTrash, FaStore, FaChevronRight } from 'react-icons/fa';

const Settings = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isBusiness = userProfile?.accountType === 'business';

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
            alert('Failed to logout. Please try again.');
        }
    };

    const handleDeleteAccount = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        try {
            setDeleting(true);

            // Delete user document from Firestore
            await deleteDoc(doc(db, 'users', currentUser.uid));

            // Delete Firebase Auth account
            await currentUser.delete();

            navigate('/login');
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Failed to delete account. Please try again or contact support.');
            setDeleting(false);
        }
    };

    const settingsSections = [
        {
            title: 'Account',
            items: [
                {
                    icon: <FaEnvelope />,
                    label: 'Email',
                    value: currentUser?.email || 'Not set',
                    onClick: () => navigate('/settings/email'),
                    color: '#3b82f6'
                },
                {
                    icon: <FaLock />,
                    label: 'Password',
                    value: '••••••••',
                    onClick: () => navigate('/settings/password'),
                    color: '#8b5cf6'
                }
            ]
        },
        {
            title: 'Preferences',
            items: [
                {
                    icon: <FaBell />,
                    label: 'Notifications',
                    value: 'Enabled',
                    onClick: () => navigate('/settings/notifications'),
                    color: '#f59e0b'
                },
                {
                    icon: <FaGlobe />,
                    label: 'Language',
                    value: 'English',
                    onClick: () => navigate('/settings/language'),
                    color: '#10b981'
                }
            ]
        },
        {
            title: 'Privacy & Security',
            items: [
                {
                    icon: <FaShieldAlt />,
                    label: 'Privacy Settings',
                    value: 'Public',
                    onClick: () => navigate('/settings/privacy'),
                    color: '#06b6d4'
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
                    label: 'Edit Business Profile',
                    value: '',
                    onClick: () => navigate('/edit-business-profile'),
                    color: '#f97316'
                }
            ]
        });
    }

    // Add Subscription section for business accounts
    if (isBusiness) {
        const subscriptionTier = userProfile?.subscriptionTier || 'free';
        const isPremium = subscriptionTier === 'premium';

        settingsSections.unshift({
            title: 'Subscription & Billing',
            items: [
                {
                    icon: isPremium ? '💎' : '📦',
                    label: 'Current Plan',
                    value: isPremium ? 'Premium' : 'Free',
                    onClick: () => navigate('/settings/subscription'),
                    color: isPremium ? '#fbbf24' : '#6b7280',
                    badge: isPremium ? null : 'Upgrade Available'
                },
                ...(isPremium ? [{
                    icon: '💳',
                    label: 'Payment Method',
                    value: userProfile?.paymentMethod || 'Not set',
                    onClick: () => navigate('/settings/payment'),
                    color: '#8b5cf6'
                }] : []),
                ...(isPremium ? [{
                    icon: '📄',
                    label: 'Billing History',
                    value: '',
                    onClick: () => navigate('/settings/billing'),
                    color: '#10b981'
                }] : [])
            ]
        });
    }

    // Check if user is guest
    const isGuest = userProfile?.accountType === 'guest' || userProfile?.role === 'guest';

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
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '20px',
                        padding: '2.5rem',
                        textAlign: 'center',
                        maxWidth: '400px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👤</div>
                        <h2 style={{
                            color: 'white',
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            marginBottom: '0.75rem'
                        }}>
                            Guest Mode
                        </h2>
                        <p style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '1rem',
                            lineHeight: '1.6',
                            marginBottom: '2rem'
                        }}>
                            You're browsing as a guest. Sign in to access all settings and personalize your experience!
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                background: 'white',
                                color: '#667eea',
                                border: 'none',
                                padding: '14px 32px',
                                borderRadius: '12px',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                width: '100%',
                                marginBottom: '0.75rem'
                            }}
                        >
                            Sign In / Sign Up
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                background: 'transparent',
                                color: 'white',
                                border: '2px solid white',
                                padding: '12px 32px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                width: '100%'
                            }}
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

            {/* User Info Card */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '20px',
                padding: '1.5rem',
                margin: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: userProfile?.profilePicture || userProfile?.photo_url
                        ? `url(${userProfile?.profilePicture || userProfile?.photo_url})`
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
                    {!userProfile?.profilePicture && !userProfile?.photo_url && (
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
                        {isBusiness && userProfile?.subscriptionTier === 'premium' && (
                            <div style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(249, 115, 22, 0.2))',
                                border: '1px solid rgba(251, 191, 36, 0.4)',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                color: '#fbbf24'
                            }}>
                                💎 Premium
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
                <div key={sectionIndex} style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '0 1.5rem',
                        marginBottom: '0.75rem'
                    }}>
                        {section.title}
                    </h3>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        margin: '0 1.5rem',
                        overflow: 'hidden'
                    }}>
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
            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#ef4444',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '0 1.5rem',
                    marginBottom: '0.75rem'
                }}>
                    Danger Zone
                </h3>
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    margin: '0 1.5rem',
                    overflow: 'hidden'
                }}>
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
            <div style={{
                textAlign: 'center',
                padding: '1rem',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
            }}>
                DineBuddies v1.0.0
            </div>
        </div>
    );
};

export default Settings;
