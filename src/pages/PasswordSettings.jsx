import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { FaArrowLeft, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import './SettingsPages.css';
import { AppText, AppTextInput } from "../components/base";

const PasswordSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError(t('error_passwords_match', 'New passwords do not match'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('error_password_length', 'Password must be at least 6 characters'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      navigate('/settings', { replace: true, state: { passwordUpdated: true } });
    } catch (err) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/wrong-password') {
        setError(t('error_current_password', 'Current password is incorrect'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('error_weak_password', 'Password is too weak'));
      } else {
        setError(t('error_update_password', 'Failed to update password. Please try again.'));
      }
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
                <AppText as="h1">{t('password_settings_title', 'Password Settings')}</AppText>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card ui-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                        <FaLock style={{ color: '#8b5cf6', fontSize: '1.5rem' }} />
                    </div>

                    <AppText as="h2">{t('change_password', 'Change Password')}</AppText>
                    <AppText as="p" className="settings-description">
                        {t('change_password_desc', 'Update your password to keep your account secure')}
                    </AppText>

                    <form onSubmit={handleUpdatePassword} className="settings-form">
                        <div className="form-group">
                            <label>{t('current_password', 'Current Password')}</label>
                            <div className="password-input-wrapper">
                                <AppTextInput
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('enter_current_password', 'Enter current password')}
                  required
                  disabled={loading} />
                
                                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowCurrent(!showCurrent)}>
                  
                                    {showCurrent ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('new_password', 'New Password')}</label>
                            <div className="password-input-wrapper">
                                <AppTextInput
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('enter_new_password', 'Enter new password')}
                  required
                  disabled={loading}
                  minLength={6} />
                
                                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowNew(!showNew)}>
                  
                                    {showNew ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('confirm_new_password', 'Confirm New Password')}</label>
                            <div className="password-input-wrapper">
                                <AppTextInput
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirm_new_password_placeholder', 'Confirm new password')}
                  required
                  disabled={loading}
                  minLength={6} />
                
                                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirm(!showConfirm)}>
                  
                                    {showConfirm ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {error &&
            <div className="error-message">
                                {error}
                            </div>
            }

                        <button
              type="submit"
              className="submit-btn ui-btn ui-btn--primary"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}>
              
                            {loading ? t('updating', 'Updating...') : t('update_password_btn', 'Update Password')}
                        </button>
                    </form>

                    <div className="settings-note">
                        <strong>{t('password_requirements', 'Password Requirements:')}</strong>
                        <ul>
                            <li>{t('req_min_length', 'At least 6 characters long')}</li>
                            <li>{t('req_mix_chars', 'Mix of letters and numbers recommended')}</li>
                            <li>{t('req_avoid_common', 'Avoid common passwords')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>);

};

export default PasswordSettings;