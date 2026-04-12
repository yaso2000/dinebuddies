import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { initNotifications } from '../services/notificationService';
import { useTranslation } from 'react-i18next';
import { FaBell, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';

const PushNotificationPrompt = () => {
    const { currentUser, userProfile, isGuest } = useAuth();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIosStandaloneRequired, setIsIosStandaloneRequired] = useState(false);

    useEffect(() => {
        if (isGuest || !currentUser || !userProfile) return;

        const dismissed = localStorage.getItem('pushPromptDismissed');
        if (dismissed === 'true') return;

        // Detect iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        // If iOS and NOT standalone (not added to home screen), Notification API is blocked by Apple.
        if (isIOS && !isStandalone) {
            setIsIosStandaloneRequired(true);
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        // Check if browser supports notifications natively
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

        // If permission is already granted or denied, don't show prompt
        if (Notification.permission !== 'default') return;

        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
    }, [currentUser, isGuest, userProfile]);

    const handleEnable = async () => {
        if (isIosStandaloneRequired) {
            // Can't enable natively. Just dismiss for now.
            handleDismiss();
            return;
        }

        try {
            const token = await initNotifications(currentUser.uid);
            if (token) {
                showToast(t('notifications_enabled', 'Push notifications enabled!'), 'success');
            } else {
                showToast(t('notifications_failed', 'Failed to enable notifications. Permission might have been denied.'), 'error');
            }
        } catch (error) {
            console.error("Error enabling notifications:", error);
            showToast(t('notifications_failed', 'Failed to enable notifications.'), 'error');
        } finally {
            setShowPrompt(false);
            localStorage.setItem('pushPromptDismissed', 'true');
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pushPromptDismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px', // above mobile nav
            left: '20px',
            right: '20px',
            maxWidth: '400px',
            margin: '0 auto',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            padding: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid var(--primary)',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--hover-overlay)', padding: '10px', borderRadius: '50%', color: 'var(--primary)', flexShrink: 0 }}>
                        <FaBell size={24} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: 1.2 }}>
                            {isIosStandaloneRequired 
                                ? t('ios_push_title', 'Install to Get Notifications')
                                : t('enable_push_title', 'Turn on Notifications')}
                        </h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {isIosStandaloneRequired 
                                ? t('ios_push_desc', 'To receive notifications on iPhone, tap the Share icon below and select "Add to Home Screen".')
                                : t('enable_push_desc', 'Get instant updates for new messages, invitations, and bookings.')}
                        </p>
                    </div>
                </div>
                <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                    <FaTimes size={18} />
                </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                    onClick={handleDismiss} 
                    style={{ flex: 1, padding: '10px', background: 'var(--bg-input)', border: 'none', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    {isIosStandaloneRequired ? t('got_it', 'Got it') : t('not_now', 'Not Now')}
                </button>
                {!isIosStandaloneRequired && (
                    <button 
                        onClick={handleEnable} 
                        style={{ flex: 1, padding: '10px', background: 'var(--primary)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        {t('enable', 'Enable')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default PushNotificationPrompt;
