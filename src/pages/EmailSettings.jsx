import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateEmail } from 'firebase/auth';
import { sendVerificationEmailResend } from '../services/verificationEmailService';
import { FaArrowLeft, FaEnvelope, FaCheckCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import './SettingsPages.css';

const EmailSettings = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleUpdateEmail = async (e) => {
        e.preventDefault();

        if (!newEmail || newEmail === currentUser.email) {
            setError(t('error_same_email', 'Please enter a different email address'));
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            await updateEmail(currentUser, newEmail);
            await sendVerificationEmailResend('settings_email');
            setSuccess(true);
            setNewEmail('');
            setTimeout(() => {
                navigate('/settings');
            }, 2000);
        } catch (err) {
            console.error('Error updating email:', err);
            if (err.code === 'auth/requires-recent-login') {
                setError(t('error_reauth_email', 'Please log out and log back in before changing your email'));
            } else if (err.code === 'auth/email-already-in-use') {
                setError(t('error_email_in_use', 'This email is already in use'));
            } else {
                setError(t('error_update_email', 'Failed to update email. Please try again.'));
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
                <h1>{t('email_settings_title', 'Email Settings')}</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <FaEnvelope style={{ color: '#3b82f6', fontSize: '1.5rem' }} />
                    </div>

                    <h2>{t('update_email_address', 'Update Email Address')}</h2>
                    <p className="settings-description">
                        {t('your_current_email', 'Your current email:')} <strong>{currentUser?.email}</strong>
                    </p>

                    {currentUser?.emailVerified ? (
                        <div className="verified-badge">
                            <FaCheckCircle /> {t('verified', 'Verified')}
                        </div>
                    ) : (
                        <div className="unverified-badge">
                            {t('email_not_verified', 'Email not verified')}
                        </div>
                    )}

                    <form onSubmit={handleUpdateEmail} className="settings-form">
                        <div className="form-group">
                            <label>{t('new_email_address', 'New Email Address')}</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder={t('enter_new_email', 'Enter new email')}
                                required
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="success-message">
                                {t('email_updated_success', 'Email updated successfully! Verification email sent.')}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={loading || !newEmail}
                        >
                            {loading ? t('updating', 'Updating...') : t('update_email_btn', 'Update Email')}
                        </button>
                    </form>

                    <div className="settings-note">
                        <strong>{t('note', 'Note:')}</strong> {t('email_verification_note', 'You will receive a verification email at your new address. Please verify it to complete the change.')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailSettings;
