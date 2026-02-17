import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
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
    FaExclamationCircle
} from 'react-icons/fa';
import './NotificationsSettings.css';

const NotificationsSettings = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Default settings
    const defaultSettings = {
        // Push notifications (in-app)
        pushEnabled: true,
        pushTypes: {
            follow: true,
            invitation_accepted: true,
            invitation_rejected: true,
            message: true,
            like: true,
            comment: true,
            reminder: true
        },

        // Email notifications
        emailEnabled: false,
        emailTypes: {
            follow: false,
            invitation_accepted: true,
            invitation_rejected: true,
            message: false,
            like: false,
            comment: false,
            reminder: true
        },

        // Sound & Vibration
        soundEnabled: true,
        vibrationEnabled: true,

        // Do Not Disturb
        doNotDisturb: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00'
        }
    };

    const [settings, setSettings] = useState(defaultSettings);

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, [currentUser]);

    const loadSettings = async () => {
        if (!currentUser?.uid) return;

        try {
            const settingsRef = doc(db, 'users', currentUser.uid, 'preferences', 'notifications');
            const settingsDoc = await getDoc(settingsRef);

            if (settingsDoc.exists()) {
                setSettings({ ...defaultSettings, ...settingsDoc.data() });
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        if (!currentUser?.uid) return;

        setSaving(true);
        try {
            const settingsRef = doc(db, 'users', currentUser.uid, 'preferences', 'notifications');
            await setDoc(settingsRef, settings, { merge: true });

            // Show success message
            alert(t('settings_saved', 'Settings saved successfully!'));
        } catch (error) {
            console.error('Error saving notification settings:', error);
            alert(t('error_saving_settings', 'Failed to save settings. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    const togglePushType = (type) => {
        setSettings(prev => ({
            ...prev,
            pushTypes: {
                ...prev.pushTypes,
                [type]: !prev.pushTypes[type]
            }
        }));
    };

    const toggleEmailType = (type) => {
        setSettings(prev => ({
            ...prev,
            emailTypes: {
                ...prev.emailTypes,
                [type]: !prev.emailTypes[type]
            }
        }));
    };

    const notificationTypes = [
        { id: 'follow', label: t('follows', 'New Followers'), icon: FaUserPlus, color: 'var(--primary)' },
        { id: 'invitation_accepted', label: t('invitations_accepted', 'Invitation Accepted'), icon: FaCheckCircle, color: '#10b981' },
        { id: 'invitation_rejected', label: t('invitations_rejected', 'Invitation Rejected'), icon: FaCheckCircle, color: '#ef4444' },
        { id: 'message', label: t('messages', 'Messages'), icon: FaCommentAlt, color: 'var(--secondary)' },
        { id: 'like', label: t('likes', 'Likes'), icon: FaHeart, color: '#f472b6' },
        { id: 'comment', label: t('comments', 'Comments'), icon: FaCommentAlt, color: '#3b82f6' },
        { id: 'reminder', label: t('reminders', 'Reminders'), icon: FaExclamationCircle, color: '#f59e0b' }
    ];

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    return (
        <div className="notification-settings-page">
            {/* Header */}
            <div className="settings-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaChevronLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
                <h1>{t('notification_settings', 'Notification Settings')}</h1>
                <div style={{ width: '40px' }} /> {/* Spacer for alignment */}
            </div>

            <div className="settings-container">
                {/* Main Toggles */}
                <div className="settings-section">
                    <h3 className="section-title">
                        <FaBell style={{ color: 'var(--primary)' }} />
                        {t('general', 'General')}
                    </h3>

                    {/* Push Notifications */}
                    <div className="setting-item">
                        <div className="setting-info">
                            <FaMobileAlt style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                            <div>
                                <h4>{t('push_notifications', 'Push Notifications')}</h4>
                                <p>{t('push_notifications_desc', 'Receive in-app notifications')}</p>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.pushEnabled}
                                onChange={(e) => setSettings({ ...settings, pushEnabled: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {/* Email Notifications */}
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

                    {/* Sound */}
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

                    {/* Vibration */}
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
                                onChange={(e) => setSettings({ ...settings, vibrationEnabled: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Notification Types - Push */}
                {settings.pushEnabled && (
                    <div className="settings-section">
                        <h3 className="section-title">
                            <FaMobileAlt style={{ color: 'var(--primary)' }} />
                            {t('push_notification_types', 'Push Notification Types')}
                        </h3>
                        {notificationTypes.map(type => (
                            <div key={type.id} className="setting-item type-item">
                                <div className="setting-info">
                                    <type.icon style={{ color: type.color, fontSize: '1.1rem' }} />
                                    <span>{type.label}</span>
                                </div>
                                <label className="toggle-switch small">
                                    <input
                                        type="checkbox"
                                        checked={settings.pushTypes[type.id]}
                                        onChange={() => togglePushType(type.id)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                {/* Notification Types - Email */}
                {settings.emailEnabled && (
                    <div className="settings-section">
                        <h3 className="section-title">
                            <FaEnvelope style={{ color: '#3b82f6' }} />
                            {t('email_notification_types', 'Email Notification Types')}
                        </h3>
                        {notificationTypes.map(type => (
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

                {/* Do Not Disturb */}
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
                                onChange={(e) => setSettings({
                                    ...settings,
                                    doNotDisturb: { ...settings.doNotDisturb, enabled: e.target.checked }
                                })}
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
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        doNotDisturb: { ...settings.doNotDisturb, startTime: e.target.value }
                                    })}
                                />
                            </div>
                            <div className="time-picker-item">
                                <FaClock style={{ color: 'var(--text-muted)' }} />
                                <label>{t('end_time', 'End Time')}</label>
                                <input
                                    type="time"
                                    value={settings.doNotDisturb.endTime}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        doNotDisturb: { ...settings.doNotDisturb, endTime: e.target.value }
                                    })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="save-button-container">
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="save-button"
                    >
                        {saving ? t('saving', 'Saving...') : t('save_settings', 'Save Settings')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationsSettings;
