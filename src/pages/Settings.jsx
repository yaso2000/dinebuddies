import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaArrowRight, FaUser, FaLock, FaMoon, FaSun,
    FaBell, FaShieldAlt, FaSignOutAlt, FaTrash, FaChevronRight,
    FaEnvelope, FaPhone, FaPalette
} from 'react-icons/fa';

const Settings = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, updateProfile } = useAuth(); // Ensure updateProfile is available from AuthContext
    const { signOut, currentUser: firebaseUser, deleteUserAccount } = useAuth();

    const [darkMode, setDarkMode] = useState(
        localStorage.getItem('darkMode') === 'true'
    );

    // Initialize notifications from user profile or defaults
    const [notifications, setNotifications] = useState({
        invitations: true,
        messages: true,
        updates: true,
        marketing: false,
        ...currentUser?.notificationPreferences
    });

    useEffect(() => {
        if (currentUser?.notificationPreferences) {
            setNotifications(prev => ({
                ...prev,
                ...currentUser.notificationPreferences
            }));
        }
    }, [currentUser]);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    useEffect(() => {
        // Sync with localStorage on mount
        const isDark = localStorage.getItem('darkMode') === 'true';
        setDarkMode(isDark);
        if (!isDark) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }, []);

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('darkMode', newMode);

        if (!newMode) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    };

    const handleNotificationChange = async (key) => {
        const newValue = !notifications[key];

        // Optimistic update
        setNotifications(prev => ({
            ...prev,
            [key]: newValue
        }));

        // Persist to Firestore
        try {
            await updateProfile({
                notificationPreferences: {
                    ...notifications,
                    [key]: newValue
                }
            });
        } catch (error) {
            console.error("Failed to update notification settings:", error);
            // Revert on error
            setNotifications(prev => ({
                ...prev,
                [key]: !newValue
            }));
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            alert(t('passwords_not_match'));
            return;
        }
        if (passwordData.new.length < 6) {
            alert(t('password_min_6_chars'));
            return;
        }

        // TODO: Implement password change with Firebase
        alert(t('password_changed_success'));
        setShowPasswordModal(false);
        setPasswordData({ current: '', new: '', confirm: '' });
    };

    const handleLogout = async () => {
        const confirmMsg = t('confirm_logout');

        if (window.confirm(confirmMsg)) {
            try {
                await signOut();
                navigate('/login');
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    };

    const handleDeleteAccount = async () => {
        const confirmMsg = t('delete_account_warning');

        if (window.confirm(confirmMsg)) {
            const doubleCheck = t('confirm_delete_type');

            const userInput = prompt(doubleCheck);
            if (userInput === 'حذف' || userInput === 'DELETE') {
                try {
                    await deleteUserAccount();
                    alert(t('account_deleted'));
                    navigate('/login');
                } catch (error) {
                    console.error('Delete account error:', error);
                    alert(t('delete_account_error'));
                }
            }
        }
    };

    const SettingItem = ({ icon: Icon, title, subtitle, action, danger, badge }) => (
        <div
            onClick={action}
            style={{
                background: 'var(--bg-card)',
                padding: '1rem 1.25rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                marginBottom: '0.75rem',
                cursor: action ? 'pointer' : 'default',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
            }}
            onMouseEnter={(e) => {
                if (action) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.transform = 'translateX(-4px)';
                }
            }}
            onMouseLeave={(e) => {
                if (action) {
                    e.currentTarget.style.background = 'var(--bg-card)';
                    e.currentTarget.style.transform = 'translateX(0)';
                }
            }}
        >
            <div style={{
                width: '45px',
                height: '45px',
                borderRadius: '12px',
                background: danger
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(244, 63, 94, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: danger ? '#ef4444' : 'var(--primary)'
            }}>
                <Icon />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{
                    fontWeight: '700',
                    marginBottom: '0.25rem',
                    color: danger ? '#ef4444' : 'white'
                }}>
                    {title}
                </div>
                {subtitle && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {subtitle}
                    </div>
                )}
            </div>
            {badge && (
                <div style={{
                    background: 'var(--accent)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '700'
                }}>
                    {badge}
                </div>
            )}
            {action && (
                <FaChevronRight style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} />
            )}
        </div>
    );

    const ToggleItem = ({ icon: Icon, title, subtitle, value, onChange }) => (
        <div style={{
            background: 'var(--bg-card)',
            padding: '1rem 1.25rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
        }}>
            <div style={{
                width: '45px',
                height: '45px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(244, 63, 94, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: 'var(--primary)'
            }}>
                <Icon />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>
                    {title}
                </div>
                {subtitle && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {subtitle}
                    </div>
                )}
            </div>
            <label style={{ position: 'relative', width: '50px', height: '28px', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={value}
                    onChange={onChange}
                    style={{ display: 'none' }}
                />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: value ? 'var(--accent)' : '#444',
                    borderRadius: '14px',
                    transition: 'all 0.3s'
                }} />
                <div style={{
                    position: 'absolute',
                    top: '3px',
                    [i18n.language === 'ar' ? 'right' : 'left']: value ? '25px' : '3px',
                    width: '22px',
                    height: '22px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: 'all 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
            </label>
        </div>
    );

    return (
        <div className="page-container" style={{ paddingBottom: '100px', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg-body)',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'white',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        {i18n.language === 'ar' ? <FaArrowRight /> : <FaArrowLeft />}
                    </button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900' }}>
                        {t('settings')}
                    </h1>
                </div>
            </div>

            <div style={{ padding: '0 1.5rem' }}>


                {/* Account Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {t('account')}
                    </h3>

                    <SettingItem
                        icon={FaUser}
                        title={t('edit_profile')}
                        subtitle={currentUser?.name}
                        action={() => navigate('/profile')}
                    />

                    {firebaseUser?.email && (
                        <SettingItem
                            icon={FaLock}
                            title={t('change_password')}
                            subtitle={t('last_updated_month')}
                            action={() => setShowPasswordModal(true)}
                        />
                    )}
                </div>

                {/* Appearance Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {t('appearance')}
                    </h3>



                    <ToggleItem
                        icon={darkMode ? FaMoon : FaSun}
                        title={t('dark_mode')}
                        subtitle={darkMode ? t('enabled') : t('disabled')}
                        value={darkMode}
                        onChange={toggleDarkMode}
                    />
                </div>

                {/* Notifications Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {t('notifications')}
                    </h3>

                    <ToggleItem
                        icon={FaBell}
                        title={t('invitation_notifications')}
                        subtitle={t('when_receive_invitation')}
                        value={notifications.invitations}
                        onChange={() => handleNotificationChange('invitations')}
                    />

                    <ToggleItem
                        icon={FaEnvelope}
                        title={t('message_notifications')}
                        subtitle={t('when_receive_message')}
                        value={notifications.messages}
                        onChange={() => handleNotificationChange('messages')}
                    />

                    <ToggleItem
                        icon={FaPhone}
                        title={t('update_notifications')}
                        subtitle={t('new_features_updates')}
                        value={notifications.updates}
                        onChange={() => handleNotificationChange('updates')}
                    />

                    <ToggleItem
                        icon={FaPalette}
                        title={t('marketing_offers')}
                        subtitle={t('exclusive_offers')}
                        value={notifications.marketing}
                        onChange={() => handleNotificationChange('marketing')}
                    />
                </div>

                {/* Business Account Section - Only show if not already a business */}
                {currentUser?.accountType !== 'business' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            color: 'var(--text-muted)',
                            marginBottom: '1rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {t('business_account')}
                        </h3>

                        <div style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                            border: '2px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                            onClick={() => navigate('/convert-to-business')}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.02)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{
                                    fontSize: '2.5rem',
                                    flexShrink: 0
                                }}>
                                    🏪
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>
                                        {t('convert_to_business')}
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '0.75rem' }}>
                                        {t('business_description')}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            background: 'rgba(139, 92, 246, 0.2)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            color: 'var(--primary)'
                                        }}>
                                            ✨ {t('free')}
                                        </span>
                                        <span style={{
                                            padding: '4px 10px',
                                            background: 'rgba(236, 72, 153, 0.2)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            color: '#ec4899'
                                        }}>
                                            🚀 {t('quick_setup')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Privacy & Security */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {t('privacy_security')}
                    </h3>

                    <SettingItem
                        icon={FaShieldAlt}
                        title={t('privacy_policy')}
                        action={() => navigate('/privacy')}
                    />

                    <SettingItem
                        icon={FaShieldAlt}
                        title={t('terms_conditions')}
                        action={() => navigate('/terms')}
                    />
                </div>

                {/* Actions Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {t('actions')}
                    </h3>

                    <SettingItem
                        icon={FaSignOutAlt}
                        title={t('logout')}
                        subtitle={t('sign_out_account')}
                        action={handleLogout}
                    />

                    <SettingItem
                        icon={FaTrash}
                        title={t('delete_account')}
                        subtitle={t('permanent_deletion')}
                        action={handleDeleteAccount}
                        danger={true}
                    />
                </div>

                {/* App Info */}
                <div style={{
                    textAlign: 'center',
                    padding: '2rem 0',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem'
                }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                        DineBuddies v1.0.0
                    </div>
                    <div>
                        {t('all_rights_reserved')}
                    </div>
                </div>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '24px',
                        padding: '2rem',
                        maxWidth: '400px',
                        width: '100%',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: '900', marginBottom: '1.5rem' }}>
                            {t('change_password')}
                        </h3>

                        <form onSubmit={handlePasswordChange}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    {t('current_password')}
                                </label>
                                <input
                                    type="password"
                                    value={passwordData.current}
                                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    {t('new_password')}
                                </label>
                                <input
                                    type="password"
                                    value={passwordData.new}
                                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                    required
                                    minLength={6}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    {t('confirm_password')}
                                </label>
                                <input
                                    type="password"
                                    value={passwordData.confirm}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                    required
                                    minLength={6}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setPasswordData({ current: '', new: '', confirm: '' });
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        background: 'transparent',
                                        border: '1px solid var(--border-color)',
                                        color: 'white',
                                        borderRadius: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        background: 'linear-gradient(135deg, var(--accent) 0%, var(--luxury-gold) 100%)',
                                        border: 'none',
                                        color: 'white',
                                        borderRadius: '12px',
                                        fontWeight: '900',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
