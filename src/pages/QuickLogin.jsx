import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const QuickLogin = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { signInWithEmail, signUpWithEmail, signInWithGoogle, continueAsGuest } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isSignUp) {
                await signUpWithEmail(email, password, name);
            } else {
                await signInWithEmail(email, password);
            }
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestMode = () => {
        continueAsGuest();
        navigate('/');
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#0a0e27',
            color: '#fff',
            padding: '2rem'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3rem',
                borderRadius: '20px',
                maxWidth: '400px',
                width: '100%'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img
                        src="/logo.png"
                        alt="DineBuddies"
                        style={{
                            width: '120px',
                            height: '120px',
                            objectFit: 'contain',
                            marginBottom: '1rem',
                            filter: 'brightness(0) invert(1)'
                        }}
                    />
                    <h2 style={{ fontSize: '2.375rem', margin: 0, color: '#FFFFFF', fontWeight: '900' }}>
                        DineBuddies
                    </h2>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(255, 0, 0, 0.2)',
                        padding: '1rem',
                        borderRadius: '10px',
                        marginBottom: '1rem',
                        color: '#ff6b6b'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {isSignUp && (
                        <input
                            type="text"
                            placeholder={t('name_placeholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '1rem',
                                marginBottom: '1rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                fontSize: '1rem'
                            }}
                        />
                    )}

                    <input
                        type="email"
                        placeholder={t('email_placeholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '1rem',
                            marginBottom: '1rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            fontSize: '1rem'
                        }}
                    />

                    <input
                        type="password"
                        placeholder={t('password_placeholder')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            fontSize: '1rem'
                        }}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            marginBottom: '1rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: '#fff',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? t('loading_dots') : (isSignUp ? t('create_account') : t('login'))}
                    </button>
                </form>

                <div style={{
                    textAlign: 'center',
                    margin: '1rem 0',
                    color: 'rgba(255, 255, 255, 0.5)'
                }}>
                    {t('or')}
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        fontSize: '1rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>🔍</span>
                    {t('sign_in_google')}
                </button>

                <div style={{ textAlign: 'center' }}>
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#667eea',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        {isSignUp ? t('have_account_login') : t('no_account_create')}
                    </button>
                </div>

                {/* Guest Mode Button */}
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                        onClick={handleGuestMode}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            padding: '0.8rem 1.5rem',
                            borderRadius: '10px',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            marginTop: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        }}
                    >
                        {t('continue_as_guest', 'Continue as Guest')}
                    </button>
                </div>

                {/* Business Signup Link */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        marginBottom: '0.75rem'
                    }}>
                        Are you a business owner?
                    </p>
                    <button
                        onClick={() => navigate('/business/signup')}
                        style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            color: '#a78bfa',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            margin: '0 auto',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))';
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))';
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>🏪</span>
                        Create Business Account
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickLogin;
