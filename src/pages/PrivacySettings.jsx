import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import './SettingsPages.css';

const PrivacySettings = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const [privacy, setPrivacy] = useState({
        profileVisibility: 'public', // public, friends, private
        showEmail: false,
        showLocation: true,
        allowMessages: true,
        allowInvitations: true,
        showActivity: true
    });

    useEffect(() => {
        if (userProfile?.privacySettings) {
            setPrivacy(userProfile.privacySettings);
        }
    }, [userProfile]);

    const handleToggle = (key) => {
        setPrivacy(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleVisibilityChange = (value) => {
        setPrivacy(prev => ({
            ...prev,
            profileVisibility: value
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        setSuccess(false);

        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                privacySettings: privacy
            });

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
            }, 3000);
        } catch (error) {
            console.error('Error updating privacy settings:', error);
            alert('Failed to update settings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>Privacy & Security</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <FaShieldAlt style={{ color: '#ef4444', fontSize: '1.5rem' }} />
                    </div>

                    <h2>Privacy Settings</h2>
                    <p className="settings-description">
                        Control who can see your information and interact with you
                    </p>

                    {/* Profile Visibility */}
                    <div className="settings-section">
                        <h3>Profile Visibility</h3>
                        <div className="radio-group">
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={privacy.profileVisibility === 'public'}
                                    onChange={() => handleVisibilityChange('public')}
                                />
                                <div>
                                    <strong>Public</strong>
                                    <p>Anyone can see your profile</p>
                                </div>
                            </label>
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={privacy.profileVisibility === 'friends'}
                                    onChange={() => handleVisibilityChange('friends')}
                                />
                                <div>
                                    <strong>Friends Only</strong>
                                    <p>Only your friends can see your profile</p>
                                </div>
                            </label>
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={privacy.profileVisibility === 'private'}
                                    onChange={() => handleVisibilityChange('private')}
                                />
                                <div>
                                    <strong>Private</strong>
                                    <p>Only you can see your profile</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Privacy Options */}
                    <div className="settings-section">
                        <h3>Privacy Options</h3>
                        <div className="notification-options">
                            <div className="notification-item">
                                <div className="notification-info">
                                    <h3>Show Email</h3>
                                    <p>Display your email on your profile</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={privacy.showEmail}
                                        onChange={() => handleToggle('showEmail')}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="notification-item">
                                <div className="notification-info">
                                    <h3>Show Location</h3>
                                    <p>Display your location on your profile</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={privacy.showLocation}
                                        onChange={() => handleToggle('showLocation')}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="notification-item">
                                <div className="notification-info">
                                    <h3>Allow Messages</h3>
                                    <p>Let others send you messages</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={privacy.allowMessages}
                                        onChange={() => handleToggle('allowMessages')}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="notification-item">
                                <div className="notification-info">
                                    <h3>Allow Invitations</h3>
                                    <p>Let others send you invitations</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={privacy.allowInvitations}
                                        onChange={() => handleToggle('allowInvitations')}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="notification-item">
                                <div className="notification-info">
                                    <h3>Show Activity</h3>
                                    <p>Display your activity status</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={privacy.showActivity}
                                        onChange={() => handleToggle('showActivity')}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {success && (
                        <div className="success-message">
                            Privacy settings saved successfully!
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        className="submit-btn"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivacySettings;
