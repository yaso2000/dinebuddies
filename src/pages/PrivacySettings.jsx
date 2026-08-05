import React, { useState, useEffect } from 'react';
import AppBackButton from '../components/AppBackButton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import './SettingsPages.css';
import { AppText } from "../components/base";

const PrivacySettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public',
    showEmail: false,
    showLocation: true,
    allowMessages: true,
    allowInvitations: true,
    showActivity: true,
    allowFollowing: true,
  });

  useEffect(() => {
    if (userProfile?.privacySettings) {
      const saved = userProfile.privacySettings;
      setPrivacy((prev) => ({
        ...prev,
        ...saved,
        allowFollowing: saved.allowFollowing !== false,
      }));
    }
  }, [userProfile]);

  const handleToggle = (key) => {
    setPrivacy((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleVisibilityChange = (value) => {
    setPrivacy((prev) => ({
      ...prev,
      profileVisibility: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);

    try {
      let finalPrivacy = {
        ...(userProfile?.privacySettings || {}),
        ...privacy,
      };
      // Enforce role-level checks: business accounts have fixed values for these fields
      if (userProfile?.role === 'business' || userProfile?.isBusiness) {
        finalPrivacy.profileVisibility = 'public';
        finalPrivacy.allowInvitations = false;
        finalPrivacy.allowFollowing = true;
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        privacySettings: finalPrivacy
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      showToast(t('error_update_settings', 'Failed to update settings. Please try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <AppBackButton fallback="/settings" />
                <AppText as="h1">{t('settings_privacy', 'Privacy & Security')}</AppText>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card ui-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <FaShieldAlt style={{ color: '#ef4444', fontSize: '1.5rem' }} />
                    </div>

                    <AppText as="h2">{t('privacy_settings', 'Privacy Settings')}</AppText>
                    <AppText as="p" className="settings-description">
                        {t('privacy_settings_desc', 'Control who can see your information and interact with you')}
                    </AppText>

                    {/* Profile Visibility */}
                    {!(userProfile?.role === 'business' || userProfile?.isBusiness) &&
          <div className="settings-section">
                            <AppText as="h3">{t('profile_visibility', 'Profile Visibility')}</AppText>
                            <div className="radio-group">
                                <label className="radio-option">
                                    <input
                  type="radio"
                  name="visibility"
                  checked={privacy.profileVisibility === 'public'}
                  onChange={() => handleVisibilityChange('public')} />
                
                                    <div>
                                        <strong>{t('public', 'Public')}</strong>
                                        <AppText as="p">{t('public_desc', 'Anyone can see your profile')}</AppText>
                                    </div>
                                </label>
                                <label className="radio-option">
                                    <input
                  type="radio"
                  name="visibility"
                  checked={privacy.profileVisibility === 'friends'}
                  onChange={() => handleVisibilityChange('friends')} />
                
                                    <div>
                                        <strong>{t('friends_only', 'Friends Only')}</strong>
                                        <AppText as="p">{t('friends_only_desc', 'Only your friends can see your profile')}</AppText>
                                    </div>
                                </label>
                                <label className="radio-option">
                                    <input
                  type="radio"
                  name="visibility"
                  checked={privacy.profileVisibility === 'private'}
                  onChange={() => handleVisibilityChange('private')} />
                
                                    <div>
                                        <strong>{t('private', 'Private')}</strong>
                                        <AppText as="p">{t('social_desc', 'Only you can see your profile')}</AppText>
                                    </div>
                                </label>
                            </div>
                        </div>
          }

                    {/* Privacy Options */}
                    <div className="settings-section">
                        <AppText as="h3">{t('privacy_options', 'Privacy Options')}</AppText>
                        <div className="notification-options">
                            <div className="notification-item">
                                <div className="notification-info">
                                    <AppText as="h3">{t('show_email', 'Show Email')}</AppText>
                                    <AppText as="p">{t('show_email_desc', 'Display your email on your profile')}</AppText>
                                </div>
                                <label className="toggle-switch">
                                    <input
                    type="checkbox"
                    checked={privacy.showEmail}
                    onChange={() => handleToggle('showEmail')} />
                  
                                    <AppText as="span" className="toggle-slider"></AppText>
                                </label>
                            </div>

                            <div className="notification-item">
                                <div className="notification-info">
                                    <AppText as="h3">{t('show_location', 'Show Location')}</AppText>
                                    <AppText as="p">{t('show_location_desc', 'Display your location on your profile')}</AppText>
                                </div>
                                <label className="toggle-switch">
                                    <input
                    type="checkbox"
                    checked={privacy.showLocation}
                    onChange={() => handleToggle('showLocation')} />
                  
                                    <AppText as="span" className="toggle-slider"></AppText>
                                </label>
                            </div>

                            <div className="notification-item">
                                <div className="notification-info">
                                    <AppText as="h3">{t('allow_messages', 'Allow Messages')}</AppText>
                                    <AppText as="p">{t('allow_messages_desc', 'Let others send you messages')}</AppText>
                                </div>
                                <label className="toggle-switch">
                                    <input
                    type="checkbox"
                    checked={privacy.allowMessages}
                    onChange={() => handleToggle('allowMessages')} />
                  
                                    <AppText as="span" className="toggle-slider"></AppText>
                                </label>
                            </div>

                            {!(userProfile?.role === 'business' || userProfile?.isBusiness) &&
              <div className="notification-item">
                                    <div className="notification-info">
                                        <AppText as="h3">{t('allow_invitations', 'Allow Invitations')}</AppText>
                                        <AppText as="p">{t('allow_invitations_desc', 'Let others send you invitations')}</AppText>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                    type="checkbox"
                    checked={privacy.allowInvitations}
                    onChange={() => handleToggle('allowInvitations')} />
                  
                                        <AppText as="span" className="toggle-slider"></AppText>
                                    </label>
                                </div>
              }

                            <div className="notification-item">
                                <div className="notification-info">
                                    <AppText as="h3">{t('show_activity', 'Show Activity')}</AppText>
                                    <AppText as="p">{t('show_activity_desc', 'Display your activity status')}</AppText>
                                </div>
                                <label className="toggle-switch">
                                    <input
                    type="checkbox"
                    checked={privacy.showActivity}
                    onChange={() => handleToggle('showActivity')} />
                  
                                    <AppText as="span" className="toggle-slider"></AppText>
                                </label>
                            </div>

                            {!(userProfile?.role === 'business' || userProfile?.isBusiness) &&
              <div className="notification-item">
                                        <div className="notification-info">
                                            <AppText as="h3">{t('allow_following', 'Allow Following')}</AppText>
                                            <AppText as="p">{t('following_disabled_desc', 'Let other users follow your profile. When off, no one can follow you (existing followers are unaffected).')}</AppText>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                    type="checkbox"
                    checked={privacy.allowFollowing !== false}
                    onChange={() => handleToggle('allowFollowing')} />
                  
                                            <AppText as="span" className="toggle-slider"></AppText>
                                        </label>
                                    </div>
              }
                        </div>
                    </div>

                    {success &&
          <div className="success-message">
                            {t('privacy_saved_success', 'Privacy settings saved successfully!')}
                        </div>
          }

                    <button
            onClick={handleSave}
            className="submit-btn ui-btn ui-btn--primary"
            disabled={loading}>
            
                        {loading ? t('saving', 'Saving...') : t('save_changes', 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>);

};

export default PrivacySettings;