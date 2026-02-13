import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { FaTimes, FaSave, FaUser, FaEnvelope, FaLock, FaPhone } from 'react-icons/fa';

const CreateUserAccount = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
        phone: ''
    });


    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const validate = () => {
        if (!formData.email || !formData.password || !formData.confirmPassword || !formData.displayName) {
            setError('Please fill in all required fields');
            return false;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        setError('');

        try {
            // Create Firebase Auth account
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                formData.email,
                formData.password
            );

            const user = userCredential.user;

            // Create Firestore document
            await setDoc(doc(db, 'users', user.uid), {
                email: formData.email,
                display_name: formData.displayName,
                accountType: 'user',
                role: 'user',
                created_at: serverTimestamp(),
                last_active_time: serverTimestamp(),
                phone: formData.phone || '',
                city: formData.city || '',
                country: formData.country || '',
                createdBy: 'admin',
                followers: [],
                following: []
            });

            // Sign out the newly created user (admin stays logged in)
            await auth.signOut();

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error creating user account:', err);

            if (err.code === 'auth/email-already-in-use') {
                setError('Email already in use');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak');
            } else {
                setError(err.message || 'Failed to create account');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflow: 'auto',
                border: '1px solid var(--border-color)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-card)',
                    zIndex: 1
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.3rem',
                            fontWeight: '800',
                            marginBottom: '0.25rem',
                            color: 'var(--text-primary)'
                        }}>
                            Create User Account
                        </h2>
                        <p style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                        }}>
                            Create a new regular user account
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            padding: '0.5rem'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        margin: '1rem 1.5rem 0',
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        color: '#ef4444',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem'
                        }}>
                            <FaUser style={{ marginRight: '0.5rem' }} />
                            Display Name *
                        </label>
                        <input
                            type="text"
                            name="displayName"
                            value={formData.displayName}
                            onChange={handleChange}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem'
                        }}>
                            <FaEnvelope style={{ marginRight: '0.5rem' }} />
                            Email Address *
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem'
                        }}>
                            <FaLock style={{ marginRight: '0.5rem' }} />
                            Password *
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={6}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem'
                        }}>
                            <FaLock style={{ marginRight: '0.5rem' }} />
                            Confirm Password *
                        </label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            minLength={6}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem'
                        }}>
                            <FaPhone style={{ marginRight: '0.5rem' }} />
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>
                </form>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '1rem',
                    position: 'sticky',
                    bottom: 0,
                    background: 'var(--bg-card)'
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'var(--bg-body)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{
                            flex: 2,
                            padding: '0.75rem',
                            background: loading ? 'var(--bg-body)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        <FaSave />
                        {loading ? 'Creating...' : 'Create User'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateUserAccount;
