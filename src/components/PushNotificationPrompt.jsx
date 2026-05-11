import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    initNotifications,
    isIOS,
    isStandalonePwa,
    getPushCapabilitySnapshot,
} from '../services/notificationService';
import { useTranslation } from 'react-i18next';
import { FaBell, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';

/** Per-user keys — global keys broke "new account same browser" (dismiss stuck from previous uid). */
function pushDismissKey(uid) {
    return `db:pushPromptDismissed:${uid}`;
}
function iosHomeHintDismissKey(uid) {
    return `db:iosAddToHomeHintDismissed:${uid}`;
}

/** '1' if push prompt was dismissed / finished while in standalone PWA — do not auto-clear dismiss (avoids prompt loop after failed Enable). */
function pushDismissStandaloneKey(uid) {
    return `db:pushDismissWasStandalone:${uid}`;
}

const PushNotificationPrompt = () => {
    const { currentUser, userProfile, isGuest } = useAuth();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIosStandaloneRequired, setIsIosStandaloneRequired] = useState(false);
    const [enableBusy, setEnableBusy] = useState(false);

    useEffect(() => {
        if (isGuest || !currentUser || !userProfile) return;

        const uid = currentUser.uid;
        console.log('[PushDebug]', getPushCapabilitySnapshot(uid));

        const pushDismissed = () => localStorage.getItem(pushDismissKey(uid)) === 'true';
        const iosHomeDismissed = () => localStorage.getItem(iosHomeHintDismissKey(uid)) === 'true';

        const standalone = isStandalonePwa();

        // Old bug: "Got it" on the install-hint used pushPromptDismissed and blocked Enable in the PWA.
        // Only clear if permission was never decided (still "default") so we do not nag after explicit "Not now" + deny.
        if (
            isIOS() &&
            standalone &&
            pushDismissed() &&
            !iosHomeDismissed() &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'default'
        ) {
            localStorage.removeItem(pushDismissKey(uid));
        }

        if (isIOS() && !standalone) {
            if (iosHomeDismissed()) return;
            setIsIosStandaloneRequired(true);
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        setIsIosStandaloneRequired(false);
        if (pushDismissed()) return;

        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
        if (Notification.permission !== 'default') return;

        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
    }, [currentUser, isGuest, userProfile]);

    const handleEnable = async () => {
        if (isIosStandaloneRequired) {
            handleDismiss();
            return;
        }

        const uid = currentUser?.uid;
        if (!uid) return;

        setEnableBusy(true);
        try {
            const token = await initNotifications(uid);
            if (token) {
                showToast(t('notifications_enabled', 'Push notifications enabled!'), 'success');
            } else {
                showToast(t('notifications_failed', 'Failed to enable notifications. Permission might have been denied.'), 'error');
            }
        } catch (error) {
            console.error("Error enabling notifications:", error);
            showToast(t('notifications_failed', 'Failed to enable notifications.'), 'error');
        } finally {
            setEnableBusy(false);
            setShowPrompt(false);
            localStorage.setItem(pushDismissKey(uid), 'true');
            if (isStandalonePwa()) {
                localStorage.setItem(pushDismissStandaloneKey(uid), '1');
            }
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        const uid = currentUser?.uid;
        if (!uid) return;
        if (isIosStandaloneRequired) {
            localStorage.setItem(iosHomeHintDismissKey(uid), 'true');
        } else {
            localStorage.setItem(pushDismissKey(uid), 'true');
            if (isStandalonePwa()) {
                localStorage.setItem(pushDismissStandaloneKey(uid), '1');
            }
        }
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
                <button type="button" onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                    <FaTimes size={18} />
                </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                    type="button"
                    onClick={handleDismiss} 
                    style={{ flex: 1, padding: '10px', background: 'var(--bg-input)', border: 'none', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    {isIosStandaloneRequired ? t('got_it', 'Got it') : t('not_now', 'Not Now')}
                </button>
                {!isIosStandaloneRequired && (
                    <button 
                        type="button"
                        onClick={handleEnable} 
                        disabled={enableBusy}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontWeight: 'bold',
                            cursor: enableBusy ? 'wait' : 'pointer',
                            opacity: enableBusy ? 0.85 : 1,
                        }}
                    >
                        {enableBusy ? t('enabling', 'Enabling…') : t('enable', 'Enable')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default PushNotificationPrompt;
