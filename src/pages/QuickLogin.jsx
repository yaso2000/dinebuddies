import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const QuickLogin = () => {
    const navigate = useNavigate();
    const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
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
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                    🍽️
                </h1>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
                    DineBuddies
                </h2>

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
                            placeholder="الاسم"
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
                        placeholder="البريد الإلكتروني"
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
                        placeholder="كلمة المرور"
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
                        {loading ? '⏳ جاري...' : (isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول')}
                    </button>
                </form>

                <div style={{
                    textAlign: 'center',
                    margin: '1rem 0',
                    color: 'rgba(255, 255, 255, 0.5)'
                }}>
                    أو
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
                    تسجيل باستخدام Google
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
                        {isSignUp ? 'لديك حساب؟ سجل دخول' : 'ليس لديك حساب؟ أنشئ واحداً'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickLogin;
