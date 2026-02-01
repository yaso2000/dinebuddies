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
    const { currentUser, updateProfile } = useInvitations();
    const { signOut, currentUser: firebaseUser, deleteUserAccount } = useAuth();

    const [darkMode, setDarkMode] = useState(
        localStorage.getItem('darkMode') === 'true'
    );
    const [notifications, setNotifications] = useState({
        invitations: true,
        messages: true,
        updates: true,
        marketing: false
    });
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

    const handleNotificationChange = (key) => {
        setNotifications(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            alert(i18n.language === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
            return;
        }
        if (passwordData.new.length < 6) {
            alert(i18n.language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
            return;
        }

        // TODO: تنفيذ تغيير كلمة المرور مع Firebase
        alert(i18n.language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
        setShowPasswordModal(false);
        setPasswordData({ current: '', new: '', confirm: '' });
    };

    const handleLogout = async () => {
        const confirmMsg = i18n.language === 'ar'
            ? 'هل أنت متأكد من تسجيل الخروج؟'
            : 'Are you sure you want to logout?';

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
        const confirmMsg = i18n.language === 'ar'
            ? 'تحذير! هذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد من حذف حسابك نهائياً؟'
            : 'Warning! This action cannot be undone. Are you sure you want to permanently delete your account?';

        if (window.confirm(confirmMsg)) {
            const doubleCheck = i18n.language === 'ar'
                ? 'تأكيد أخير: اكتب "حذف" للمتابعة'
                : 'Final confirmation: Type "DELETE" to proceed';

            const userInput = prompt(doubleCheck);
            if (userInput === 'حذف' || userInput === 'DELETE') {
                try {
                    await deleteUserAccount();
                    alert(i18n.language === 'ar' ? 'تم حذف الحساب' : 'Account deleted');
                    navigate('/login');
                } catch (error) {
                    console.error('Delete account error:', error);
                    alert(i18n.language === 'ar'
                        ? 'حدث خطأ أثناء حذف الحساب. لأسباب أمنية، يرجى تسجيل الدخول مرة أخرى والمحاولة.'
                        : 'Error deleting account. For security reasons, please re-login and try again.');
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
                        {i18n.language === 'ar' ? 'الإعدادات' : 'Settings'}
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
                        {i18n.language === 'ar' ? '👤 الحساب' : '👤 Account'}
                    </h3>

                    <SettingItem
                        icon={FaUser}
                        title={i18n.language === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}
                        subtitle={currentUser?.name}
                        action={() => navigate('/profile')}
                    />

                    {firebaseUser?.email && (
                        <SettingItem
                            icon={FaLock}
                            title={i18n.language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                            subtitle={i18n.language === 'ar' ? 'آخر تحديث: شهر واحد' : 'Last updated: 1 month ago'}
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
                        {i18n.language === 'ar' ? '🎨 المظهر' : '🎨 Appearance'}
                    </h3>



                    <ToggleItem
                        icon={darkMode ? FaMoon : FaSun}
                        title={i18n.language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
                        subtitle={darkMode ? (i18n.language === 'ar' ? 'مفعل' : 'Enabled') : (i18n.language === 'ar' ? 'معطل' : 'Disabled')}
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
                        {i18n.language === 'ar' ? '🔔 الإشعارات' : '🔔 Notifications'}
                    </h3>

                    <ToggleItem
                        icon={FaBell}
                        title={i18n.language === 'ar' ? 'إشعارات الدعوات' : 'Invitation Notifications'}
                        subtitle={i18n.language === 'ar' ? 'عند تلقي دعوة جديدة' : 'When you receive a new invitation'}
                        value={notifications.invitations}
                        onChange={() => handleNotificationChange('invitations')}
                    />

                    <ToggleItem
                        icon={FaEnvelope}
                        title={i18n.language === 'ar' ? 'إشعارات الرسائل' : 'Message Notifications'}
                        subtitle={i18n.language === 'ar' ? 'عند تلقي رسالة جديدة' : 'When you receive a new message'}
                        value={notifications.messages}
                        onChange={() => handleNotificationChange('messages')}
                    />

                    <ToggleItem
                        icon={FaPhone}
                        title={i18n.language === 'ar' ? 'إشعارات التحديثات' : 'Update Notifications'}
                        subtitle={i18n.language === 'ar' ? 'ميزات جديدة وتحديثات' : 'New features and updates'}
                        value={notifications.updates}
                        onChange={() => handleNotificationChange('updates')}
                    />

                    <ToggleItem
                        icon={FaPalette}
                        title={i18n.language === 'ar' ? 'العروض والتسويق' : 'Marketing & Offers'}
                        subtitle={i18n.language === 'ar' ? 'عروض حصرية وخصومات' : 'Exclusive offers and discounts'}
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
                            {i18n.language === 'ar' ? '🏢 حساب منشأة' : '🏢 Business Account'}
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
                                        {i18n.language === 'ar' ? 'حوّل حسابك إلى منشأة' : 'Convert to Business Account'}
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '0.75rem' }}>
                                        {i18n.language === 'ar'
                                            ? 'احصل على صفحة احترافية، شارك المنيو والعروض، وتواصل مع العملاء'
                                            : 'Get a professional page, share menu & offers, and connect with customers'
                                        }
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
                                            ✨ {i18n.language === 'ar' ? 'مجاني' : 'Free'}
                                        </span>
                                        <span style={{
                                            padding: '4px 10px',
                                            background: 'rgba(236, 72, 153, 0.2)',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            color: '#ec4899'
                                        }}>
                                            🚀 {i18n.language === 'ar' ? 'سريع' : 'Quick Setup'}
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
                        {i18n.language === 'ar' ? '🔒 الخصوصية والأمان' : '🔒 Privacy & Security'}
                    </h3>

                    <SettingItem
                        icon={FaShieldAlt}
                        title={i18n.language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
                        action={() => navigate('/privacy')}
                    />

                    <SettingItem
                        icon={FaShieldAlt}
                        title={i18n.language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
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
                        {i18n.language === 'ar' ? '⚡ الإجراءات' : '⚡ Actions'}
                    </h3>

                    <SettingItem
                        icon={FaSignOutAlt}
                        title={i18n.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                        subtitle={i18n.language === 'ar' ? 'الخروج من الحساب الحالي' : 'Sign out of current account'}
                        action={handleLogout}
                    />

                    <SettingItem
                        icon={FaTrash}
                        title={i18n.language === 'ar' ? 'حذف الحساب' : 'Delete Account'}
                        subtitle={i18n.language === 'ar' ? 'حذف نهائي لا يمكن التراجع عنه' : 'Permanent deletion, cannot be undone'}
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
                        {i18n.language === 'ar' ? '© 2026 جميع الحقوق محفوظة' : '© 2026 All Rights Reserved'}
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
                            {i18n.language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                        </h3>

                        <form onSubmit={handlePasswordChange}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    {i18n.language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
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
                                    {i18n.language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
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
                                    {i18n.language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
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
                                    {i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
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
                                    {i18n.language === 'ar' ? 'تحديث' : 'Update'}
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
