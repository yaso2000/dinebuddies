import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
    disablePushNotifications,
    syncPushDeviceRegistration,
    registerPushDeviceFromUserGesture,
    isIOS,
    isStandalonePwa,
    getPushCapabilitySnapshot,
    describePushBlocker,
    revivePushDelivery,
    formatPushRegistrationError,
    getLastFcmRegistrationError,
} from '../services/notificationService';
import { persistPushEnabledPref } from '../services/pushPrefs';
import {
    schedulePushRegistration,
    startBackgroundPushRegistration,
} from '../services/pushRegistrationCoordinator';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import {
    FaChevronLeft,
    FaBell,
    FaEnvelope,
    FaVolumeUp,
    FaMobileAlt,
    FaMoon,
    FaClock,
    FaUserPlus,
    FaCheckCircle,
    FaCommentAlt,
    FaHeart,
    FaExclamationCircle,
} from 'react-icons/fa';
import './NotificationsSettings.css';

const defaultSettings = {
    pushEnabled: false,
    pushTypes: {
        follow: true,
        invitation_accepted: true,
        invitation_rejected: true,
        message: true,
        like: true,
        comment: true,
        reminder: true,
        business_post: true,
        new_booking: true,
        business_feedback: true,
    },
    emailEnabled: false,
    emailTypes: {
        follow: false,
        invitation_accepted: true,
        invitation_rejected: true,
        message: false,
        like: false,
        comment: false,
        reminder: true,
    },
    soundEnabled: true,
    vibrationEnabled: true,
    doNotDisturb: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
    },
};

function mergePushTypes(saved) {
    return { ...defaultSettings.pushTypes, ...(saved && typeof saved === 'object' ? saved : {}) };
}

function mergeEmailTypes(saved) {
    return { ...defaultSettings.emailTypes, ...(saved && typeof saved === 'object' ? saved : {}) };
}

const NotificationsSettings = () => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pushBusy, setPushBusy] = useState(false);
    const [settings, setSettings] = useState(defaultSettings);
    const [permissionState, setPermissionState] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'
    );
    const iosNeedsHomeScreen = isIOS() && !isStandalonePwa();
    const canTurnPushOn =
        typeof Notification !== 'undefined' && permissionState !== 'denied';

    const refreshPermission = useCallback(() => {
        if (typeof Notification !== 'undefined') {
            setPermissionState(Notification.permission);
        }
    }, []);

    useEffect(() => {
        if (!currentUser?.uid) {
            setLoading(false);
            return;
        }
        loadSettings();
    }, [currentUser?.uid]);

    useEffect(() => {
        const onVis = () => {
            refreshPermission();
            if (
                document.visibilityState === 'visible' &&
                currentUser?.uid &&
                settings.pushEnabled &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'granted'
            ) {
                void revivePushDelivery(currentUser.uid, { label: 'settings-resume' });
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [refreshPermission, currentUser?.uid, settings.pushEnabled]);

    const loadSettings = async () => {
        if (!currentUser?.uid) {
            setLoading(false);
            return;
        }

        setLoading(true);
        refreshPermission();
        try {
            const settingsRef = doc(db, 'users', currentUser.uid, 'preferences', 'notifications');
            const settingsDoc = await getDoc(settingsRef);

            let merged = { ...defaultSettings };
            if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                merged = {
                    ...merged,
                    ...data,
                    pushTypes: mergePushTypes(data.pushTypes),
                    emailTypes: mergeEmailTypes(data.emailTypes),
                    doNotDisturb: { ...defaultSettings.doNotDisturb, ...(data.doNotDisturb || {}) },
                };
                merged.pushEnabled = data.pushEnabled === true;
            }

            setSettings(merged);

            if (merged.pushEnabled) {
                syncPushDeviceRegistration(currentUser.uid, true);
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const pushErrorMessage = (reason) => {
        const key = describePushBlocker(reason);
        if (key === 'ios_needs_home_screen') {
            return t(
                'ios_push_settings_hint',
                'On iPhone, add DineBuddies to your Home Screen, then open the app from that icon to enable push.'
            );
        }
        if (key === 'permission_denied') {
            return t(
                'push_permission_denied_ios',
                'Notifications are blocked. Open iPhone Settings → Notifications → DineBuddies and allow alerts.'
            );
        }
        if (key === 'missing_vapid') {
            return t('push_config_error', 'Push is not configured on this build. Contact support.');
        }
        return t('push_enable_failed', 'Could not enable push. Try again from the Home Screen app.');
    };

    /** iOS: entire permission → SW → getToken chain runs inside this async click handler. */
    const beginEnablePush = async () => {
        if (!currentUser?.uid || pushBusy) return;
        if (!canTurnPushOn) {
            showToast(
                pushErrorMessage(iosNeedsHomeScreen ? 'ios_needs_home_screen' : 'permission_denied'),
                'error'
            );
            return;
        }

        setPushBusy(true);
        setSettings((prev) => ({ ...prev, pushEnabled: true }));

        try {
            const result = await registerPushDeviceFromUserGesture(currentUser.uid, {
                requestPermissionIfNeeded: true,
            });

            refreshPermission();

            if (result.reason === 'service_worker_reload') {
                return;
            }

            if (!result.ok) {
                setSettings((prev) => ({ ...prev, pushEnabled: false }));
                await persistPushEnabledPref(currentUser.uid, false);
                const detail = formatPushRegistrationError(
                    result.lastError || getLastFcmRegistrationError()
                );
                showToast(
                    detail
                        ? `${pushErrorMessage(result.reason)} (${detail})`
                        : pushErrorMessage(result.reason),
                    'error'
                );
                return;
            }

            showToast(
                t('push_enabled_success', 'Push notifications enabled for this device.'),
                'success'
            );
        } catch (err) {
            console.error('Enable push failed:', err);
            setSettings((prev) => ({ ...prev, pushEnabled: false }));
            await persistPushEnabledPref(currentUser.uid, false);
            showToast(
                formatPushRegistrationError(err) || pushErrorMessage('token_failed'),
                'error'
            );
        } finally {
            setPushBusy(false);
        }
    };

    const handlePushToggle = (e) => {
        const wantOn = e.target.checked;

        if (wantOn) {
            if (permissionState === 'default') {
                e.target.checked = false;
            }
            void beginEnablePush();
            return;
        }

        setSettings((prev) => ({ ...prev, pushEnabled: false }));
        setPushBusy(true);
        void (async () => {
            try {
                await disablePushNotifications(currentUser.uid);
                showToast(t('push_disabled_success', 'Push notifications turned off.'), 'success');
            } catch (err) {
                console.error('Disable push failed:', err);
                showToast(t('error_saving_settings', 'Failed to save settings. Please try again.'), 'error');
            } finally {
                setPushBusy(false);
            }
        })();
    };

    const saveSettings = async () => {
        if (!currentUser?.uid || saving) return;

        const wantPush = settings.pushEnabled === true;
        setSaving(true);

        try {
            const settingsRef = doc(db, 'users', currentUser.uid, 'preferences', 'notifications');
            const payload = {
                pushEnabled: wantPush,
                pushTypes: settings.pushTypes,
                emailEnabled: settings.emailEnabled,
                emailTypes: settings.emailTypes,
                soundEnabled: settings.soundEnabled,
                vibrationEnabled: settings.vibrationEnabled,
                doNotDisturb: settings.doNotDisturb,
            };
            await setDoc(settingsRef, payload, { merge: true });

            showToast(t('settings_saved', 'Settings saved successfully!'), 'success');

            syncPushDeviceRegistration(currentUser.uid, wantPush && canTurnPushOn);
        } catch (error) {
            console.error('Error saving notification settings:', error);
            showToast(t('error_saving_settings', 'Failed to save settings. Please try again.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const togglePushType = (type) => {
        setSettings((prev) => ({
            ...prev,
            pushTypes: {
                ...prev.pushTypes,
                [type]: !prev.pushTypes[type],
            },
        }));
    };

    const toggleEmailType = (type) => {
        setSettings((prev) => ({
            ...prev,
            emailTypes: {
                ...prev.emailTypes,
                [type]: !prev.emailTypes[type],
            },
        }));
    };

    const notificationTypes = [
        { id: 'follow', label: t('follows', 'New Followers'), icon: FaUserPlus, color: 'var(--primary)' },
        {
            id: 'invitation_accepted',
            label: t('invitations_accepted', 'Invitation Accepted'),
            icon: FaCheckCircle,
            color: '#10b981',
        },
        {
            id: 'invitation_rejected',
            label: t('invitations_rejected', 'Invitation Rejected'),
            icon: FaCheckCircle,
            color: '#ef4444',
        },
        { id: 'message', label: t('messages', 'Messages'), icon: FaCommentAlt, color: 'var(--secondary)' },
        { id: 'like', label: t('likes', 'Likes'), icon: FaHeart, color: '#f472b6' },
        { id: 'comment', label: t('comments', 'Comments'), icon: FaCommentAlt, color: '#3b82f6' },
        { id: 'reminder', label: t('reminders', 'Reminders'), icon: FaExclamationCircle, color: '#f59e0b' },
    ];

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    const pushDiag = currentUser?.uid ? getPushCapabilitySnapshot(currentUser.uid) : null;
    const showPermissionPromptCard = canTurnPushOn && permissionState === 'default';
    const pushAlreadyGranted = permissionState === 'granted';

    return (
        <div className="notification-settings-page">
            <div className="settings-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaChevronLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
                <h1>{t('notification_settings', 'Notification Settings')}</h1>
                <div style={{ width: '40px' }} />
            </div>

            <div className="settings-container">
                {iosNeedsHomeScreen && (
                    <div className="notification-settings-ios-hint" role="status">
                        <FaMobileAlt style={{ flexShrink: 0, color: 'var(--primary)' }} />
                        <div>
                            <strong>{t('ios_push_title', 'Install to Get Notifications')}</strong>
                            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', lineHeight: 1.45 }}>
                                {t(
                                    'ios_push_settings_hint',
                                    'On iPhone: Safari → Share → Add to Home Screen. Open DineBuddies from that icon, then return here.'
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {permissionState === 'denied' && !iosNeedsHomeScreen && (
                    <div
                        className="notification-settings-ios-hint"
                        role="status"
                        style={{ borderColor: 'rgba(239,68,68,0.4)' }}
                    >
                        <FaBell style={{ flexShrink: 0, color: '#ef4444' }} />
                        <div>
                            <strong>{t('push_blocked_title', 'Notifications blocked')}</strong>
                            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', lineHeight: 1.45 }}>
                                {t(
                                    'push_permission_denied_ios',
                                    'Open iPhone Settings → Notifications → DineBuddies → Allow Notifications. You can still turn push off below and tap Save.'
                                )}
                            </p>
                        </div>
                    </div>
                )}

                <div className="settings-section">
                    <h3 className="section-title">
                        <FaBell style={{ color: 'var(--primary)' }} />
                        {t('general', 'General')}
                    </h3>

                    {showPermissionPromptCard && (
                        <div
                            className="notification-settings-ios-hint"
                            role="region"
                            aria-label={t('enable_push_title', 'Turn on Notifications')}
                            style={{
                                marginBottom: '14px',
                                borderColor: 'rgba(139, 92, 246, 0.45)',
                                background:
                                    'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(236, 72, 153, 0.06))',
                            }}
                        >
                            <FaBell style={{ flexShrink: 0, color: 'var(--primary)' }} />
                            <div style={{ flex: 1 }}>
                                <strong>{t('enable_push_title', 'Turn on Notifications')}</strong>
                                <p style={{ margin: '6px 0 12px', fontSize: '0.85rem', lineHeight: 1.45 }}>
                                    {t(
                                        'enable_push_desc',
                                        'Tap below — iPhone will ask “Allow notifications?”. Choose Allow to receive alerts.'
                                    )}
                                </p>
                                <button
                                    type="button"
                                    className="save-button"
                                    style={{ width: '100%' }}
                                    disabled={pushBusy}
                                    onClick={() => void beginEnablePush()}
                                >
                                    {pushBusy
                                        ? t('enabling', 'Enabling…')
                                        : t('ios_allow_push_button', 'Allow notifications on this iPhone')}
                                </button>
                            </div>
                        </div>
                    )}

                    {pushAlreadyGranted && !settings.pushEnabled && (
                        <p
                            style={{
                                fontSize: '0.82rem',
                                color: 'var(--text-muted)',
                                margin: '0 0 12px',
                                lineHeight: 1.45,
                            }}
                        >
                            {t(
                                'push_ios_already_allowed',
                                'This iPhone already allows notifications. Turn on the switch below to register this device.'
                            )}
                        </p>
                    )}

                    <div className="setting-item">
                        <div className="setting-info">
                            <FaMobileAlt style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                            <div>
                                <h4>{t('push_notifications', 'Push Notifications')}</h4>
                                <p>{t('push_notifications_desc', 'Alerts on this device when the app is closed')}</p>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={!!settings.pushEnabled}
                                disabled={
                                    pushBusy ||
                                    (permissionState === 'denied' && !settings.pushEnabled)
                                }
                                onChange={handlePushToggle}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {import.meta.env.DEV && pushDiag && (
                        <p
                            style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                margin: '0 0 12px',
                                wordBreak: 'break-all',
                            }}
                        >
                            [dev] {JSON.stringify(pushDiag)}
                        </p>
                    )}

                    <div className="setting-item">
                        <div className="setting-info">
                            <FaEnvelope style={{ color: '#3b82f6', fontSize: '1.2rem' }} />
                            <div>
                                <h4>{t('email_notifications', 'Email Notifications')}</h4>
                                <p>{t('email_notifications_desc', 'Receive notifications via email')}</p>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.emailEnabled}
                                onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <FaVolumeUp style={{ color: '#10b981', fontSize: '1.2rem' }} />
                            <div>
                                <h4>{t('sound', 'Sound')}</h4>
                                <p>{t('sound_desc', 'Play sound for notifications')}</p>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.soundEnabled}
                                onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <FaMobileAlt style={{ color: '#f59e0b', fontSize: '1.2rem' }} />
                            <div>
                                <h4>{t('vibration', 'Vibration')}</h4>
                                <p>{t('vibration_desc', 'Vibrate for notifications')}</p>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.vibrationEnabled}
                                onChange={(e) =>
                                    setSettings({ ...settings, vibrationEnabled: e.target.checked })
                                }
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                {settings.pushEnabled && (
                    <div className="settings-section">
                        <h3 className="section-title">
                            <FaMobileAlt style={{ color: 'var(--primary)' }} />
                            {t('push_notification_types', 'Push Notification Types')}
                        </h3>
                        {notificationTypes.map((type) => (
                            <div key={type.id} className="setting-item type-item">
                                <div className="setting-info">
                                    <type.icon style={{ color: type.color, fontSize: '1.1rem' }} />
                                    <span>{type.label}</span>
                                </div>
                                <label className="toggle-switch small">
                                    <input
                                        type="checkbox"
                                        checked={settings.pushTypes[type.id] !== false}
                                        onChange={() => togglePushType(type.id)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                {settings.emailEnabled && (
                    <div className="settings-section">
                        <h3 className="section-title">
                            <FaEnvelope style={{ color: '#3b82f6' }} />
                            {t('email_notification_types', 'Email Notification Types')}
                        </h3>
                        {notificationTypes.map((type) => (
                            <div key={type.id} className="setting-item type-item">
                                <div className="setting-info">
                                    <type.icon style={{ color: type.color, fontSize: '1.1rem' }} />
                                    <span>{type.label}</span>
                                </div>
                                <label className="toggle-switch small">
                                    <input
                                        type="checkbox"
                                        checked={settings.emailTypes[type.id]}
                                        onChange={() => toggleEmailType(type.id)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                <div className="settings-section">
                    <h3 className="section-title">
                        <FaMoon style={{ color: '#8b5cf6' }} />
                        {t('do_not_disturb', 'Do Not Disturb')}
                    </h3>

                    <div className="setting-item">
                        <div className="setting-info">
                            <FaMoon style={{ color: '#8b5cf6', fontSize: '1.2rem' }} />
                            <div>
                                <h4>{t('enable_dnd', 'Enable Do Not Disturb')}</h4>
                                <p>{t('dnd_desc', 'Silence notifications during specific hours')}</p>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.doNotDisturb.enabled}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        doNotDisturb: { ...settings.doNotDisturb, enabled: e.target.checked },
                                    })
                                }
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {settings.doNotDisturb.enabled && (
                        <div className="time-picker-container">
                            <div className="time-picker-item">
                                <FaClock style={{ color: 'var(--text-muted)' }} />
                                <label>{t('start_time', 'Start Time')}</label>
                                <input
                                    type="time"
                                    value={settings.doNotDisturb.startTime}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            doNotDisturb: {
                                                ...settings.doNotDisturb,
                                                startTime: e.target.value,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="time-picker-item">
                                <FaClock style={{ color: 'var(--text-muted)' }} />
                                <label>{t('end_time', 'End Time')}</label>
                                <input
                                    type="time"
                                    value={settings.doNotDisturb.endTime}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            doNotDisturb: {
                                                ...settings.doNotDisturb,
                                                endTime: e.target.value,
                                            },
                                        })
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="save-button-container">
                    <button onClick={saveSettings} disabled={saving} className="save-button">
                        {saving ? t('saving', 'Saving...') : t('save_settings', 'Save Settings')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationsSettings;
