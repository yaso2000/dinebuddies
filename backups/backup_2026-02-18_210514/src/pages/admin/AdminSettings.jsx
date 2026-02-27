import React, { useState, useEffect } from 'react';
import QuickAdminSetup from '../../components/admin/QuickAdminSetup';
import { FaCog, FaDatabase, FaShieldAlt, FaBell, FaPalette, FaSave, FaEnvelope, FaKey } from 'react-icons/fa';

const AdminSettings = () => {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        general: {
            siteName: 'DineBuddies',
            siteDescription: 'Connect with people for dining experiences',
            maintenanceMode: false,
            registrationEnabled: true
        },
        email: {
            fromName: 'DineBuddies',
            fromEmail: 'noreply@dinebuddies.com',
            replyTo: 'support@dinebuddies.com'
        },
        notifications: {
            emailNotifications: true,
            pushNotifications: false,
            smsNotifications: false,
            newUserNotification: true,
            newSubscriptionNotification: true
        },
        security: {
            requireEmailVerification: true,
            twoFactorAuth: false,
            sessionTimeout: 30,
            maxLoginAttempts: 5
        }
    });

    const handleInputChange = (section, field, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleSaveSettings = async () => {
        try {
            setLoading(true);
            // Save to localStorage for now (Firestore requires setup)
            localStorage.setItem('adminSettings', JSON.stringify(settings));
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Load settings from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('adminSettings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
    }, []);

    return (
        <div>
            {/* Header */}
            <div className="admin-flex-between admin-mb-4">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">Settings</h1>
                    <p className="admin-page-subtitle">Configure your admin panel and application settings</p>
                </div>
                <button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="admin-btn admin-btn-primary"
                >
                    <FaSave />
                    {loading ? 'Saving...' : 'Save All Settings'}
                </button>
            </div>

            {/* Quick Admin Setup */}
            <div className="admin-mb-4">
                <QuickAdminSetup />
            </div>

            {/* Settings Grid */}
            <div className="admin-grid admin-grid-2">
                {/* General Settings */}
                <div className="admin-card">
                    <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(99, 102, 241, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FaCog style={{ fontSize: '1.5rem', color: '#6366f1' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                                General Settings
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Basic configuration
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label className="admin-label">Site Name</label>
                            <input
                                type="text"
                                value={settings.general.siteName}
                                onChange={(e) => handleInputChange('general', 'siteName', e.target.value)}
                                className="admin-input"
                            />
                        </div>
                        <div>
                            <label className="admin-label">Site Description</label>
                            <textarea
                                value={settings.general.siteDescription}
                                onChange={(e) => handleInputChange('general', 'siteDescription', e.target.value)}
                                className="admin-input"
                                rows="3"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.general.maintenanceMode}
                                    onChange={(e) => handleInputChange('general', 'maintenanceMode', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Maintenance Mode
                            </label>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                                Disable site for maintenance
                            </p>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.general.registrationEnabled}
                                    onChange={(e) => handleInputChange('general', 'registrationEnabled', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Enable User Registration
                            </label>
                        </div>
                    </div>
                </div>

                {/* Email Settings */}
                <div className="admin-card">
                    <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FaEnvelope style={{ fontSize: '1.5rem', color: '#f59e0b' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                                Email Settings
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Configure email sender
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label className="admin-label">From Name</label>
                            <input
                                type="text"
                                value={settings.email.fromName}
                                onChange={(e) => handleInputChange('email', 'fromName', e.target.value)}
                                className="admin-input"
                            />
                        </div>
                        <div>
                            <label className="admin-label">From Email</label>
                            <input
                                type="email"
                                value={settings.email.fromEmail}
                                onChange={(e) => handleInputChange('email', 'fromEmail', e.target.value)}
                                className="admin-input"
                            />
                        </div>
                        <div>
                            <label className="admin-label">Reply-To Email</label>
                            <input
                                type="email"
                                value={settings.email.replyTo}
                                onChange={(e) => handleInputChange('email', 'replyTo', e.target.value)}
                                className="admin-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Security Settings */}
                <div className="admin-card">
                    <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(34, 197, 94, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FaShieldAlt style={{ fontSize: '1.5rem', color: '#22c55e' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                                Security
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Security & permissions
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.security.requireEmailVerification}
                                    onChange={(e) => handleInputChange('security', 'requireEmailVerification', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Require Email Verification
                            </label>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.security.twoFactorAuth}
                                    onChange={(e) => handleInputChange('security', 'twoFactorAuth', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Enable Two-Factor Authentication
                            </label>
                        </div>
                        <div>
                            <label className="admin-label">Session Timeout (minutes)</label>
                            <input
                                type="number"
                                value={settings.security.sessionTimeout}
                                onChange={(e) => handleInputChange('security', 'sessionTimeout', parseInt(e.target.value))}
                                className="admin-input"
                                min="5"
                                max="1440"
                            />
                        </div>
                        <div>
                            <label className="admin-label">Max Login Attempts</label>
                            <input
                                type="number"
                                value={settings.security.maxLoginAttempts}
                                onChange={(e) => handleInputChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                                className="admin-input"
                                min="3"
                                max="10"
                            />
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="admin-card">
                    <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(139, 92, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FaBell style={{ fontSize: '1.5rem', color: '#8b5cf6' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                                Notifications
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Notification preferences
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.notifications.emailNotifications}
                                    onChange={(e) => handleInputChange('notifications', 'emailNotifications', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Email Notifications
                            </label>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.notifications.pushNotifications}
                                    onChange={(e) => handleInputChange('notifications', 'pushNotifications', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Push Notifications
                            </label>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.notifications.smsNotifications}
                                    onChange={(e) => handleInputChange('notifications', 'smsNotifications', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                SMS Notifications
                            </label>
                        </div>
                        <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '0.75rem' }}>
                                Admin Notifications
                            </p>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.notifications.newUserNotification}
                                        onChange={(e) => handleInputChange('notifications', 'newUserNotification', e.target.checked)}
                                        style={{ width: '1rem', height: '1rem' }}
                                    />
                                    Notify on new user registration
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.notifications.newSubscriptionNotification}
                                        onChange={(e) => handleInputChange('notifications', 'newSubscriptionNotification', e.target.checked)}
                                        style={{ width: '1rem', height: '1rem' }}
                                    />
                                    Notify on new subscription
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* API Keys */}
                <div className="admin-card">
                    <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(236, 72, 153, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FaKey style={{ fontSize: '1.5rem', color: '#ec4899' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                                API Keys
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Manage API integrations
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label className="admin-label">Stripe Publishable Key</label>
                            <input
                                type="text"
                                placeholder="pk_test_..."
                                className="admin-input"
                                disabled
                            />
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                Set in environment variables
                            </p>
                        </div>
                        <div>
                            <label className="admin-label">Google Maps API Key</label>
                            <input
                                type="text"
                                placeholder="AIza..."
                                className="admin-input"
                                disabled
                            />
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                Set in environment variables
                            </p>
                        </div>
                        <div className="admin-card" style={{ background: '#0f172a', padding: '0.75rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                💡 API keys are managed through environment variables for security
                            </p>
                        </div>
                    </div>
                </div>

                {/* Database */}
                <div className="admin-card">
                    <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FaDatabase style={{ fontSize: '1.5rem', color: '#3b82f6' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                                Database
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Firestore configuration
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div className="admin-card" style={{ background: '#0f172a', padding: '1rem' }}>
                            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                                <div className="admin-flex-between">
                                    <span style={{ color: '#94a3b8' }}>Status:</span>
                                    <span className="admin-badge admin-badge-success">Connected</span>
                                </div>
                                <div className="admin-flex-between">
                                    <span style={{ color: '#94a3b8' }}>Provider:</span>
                                    <span style={{ color: '#ffffff' }}>Firebase Firestore</span>
                                </div>
                                <div className="admin-flex-between">
                                    <span style={{ color: '#94a3b8' }}>Region:</span>
                                    <span style={{ color: '#ffffff' }}>us-central1</span>
                                </div>
                            </div>
                        </div>
                        <button
                            className="admin-btn admin-btn-secondary"
                            onClick={() => window.open('https://console.firebase.google.com', '_blank')}
                        >
                            Open Firebase Console
                        </button>
                    </div>
                </div>
            </div>

            {/* Save Button (Bottom) */}
            <div className="admin-mt-4" style={{ textAlign: 'right' }}>
                <button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="admin-btn admin-btn-primary"
                    style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
                >
                    <FaSave />
                    {loading ? 'Saving...' : 'Save All Settings'}
                </button>
            </div>
        </div>
    );
};

export default AdminSettings;
