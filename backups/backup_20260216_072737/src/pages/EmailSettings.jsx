import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateEmail, sendEmailVerification } from 'firebase/auth';
import { FaArrowLeft, FaEnvelope, FaCheckCircle } from 'react-icons/fa';
import './SettingsPages.css';

const EmailSettings = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleUpdateEmail = async (e) => {
        e.preventDefault();

        if (!newEmail || newEmail === currentUser.email) {
            setError('Please enter a different email address');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            await updateEmail(currentUser, newEmail);
            await sendEmailVerification(currentUser);
            setSuccess(true);
            setNewEmail('');
            setTimeout(() => {
                navigate('/settings');
            }, 2000);
        } catch (err) {
            console.error('Error updating email:', err);
            if (err.code === 'auth/requires-recent-login') {
                setError('Please log out and log back in before changing your email');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('This email is already in use');
            } else {
                setError('Failed to update email. Please try again.');
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
                <h1>Email Settings</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <FaEnvelope style={{ color: '#3b82f6', fontSize: '1.5rem' }} />
                    </div>

                    <h2>Update Email Address</h2>
                    <p className="settings-description">
                        Your current email: <strong>{currentUser?.email}</strong>
                    </p>

                    {currentUser?.emailVerified ? (
                        <div className="verified-badge">
                            <FaCheckCircle /> Verified
                        </div>
                    ) : (
                        <div className="unverified-badge">
                            Email not verified
                        </div>
                    )}

                    <form onSubmit={handleUpdateEmail} className="settings-form">
                        <div className="form-group">
                            <label>New Email Address</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="Enter new email"
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
                                Email updated successfully! Verification email sent.
                            </div>
                        )}

                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={loading || !newEmail}
                        >
                            {loading ? 'Updating...' : 'Update Email'}
                        </button>
                    </form>

                    <div className="settings-note">
                        <strong>Note:</strong> You will receive a verification email at your new address.
                        Please verify it to complete the change.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailSettings;
