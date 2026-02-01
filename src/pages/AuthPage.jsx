import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMobileAlt, FaEnvelope, FaApple, FaCheck, FaArrowRight } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signOut as fbSignOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';

const AuthPage = () => {
    const navigate = useNavigate();
    const {
        sendPhoneOTP,
        verifyPhoneOTP,
        signInWithGoogle,
        signInWithApple,
        signUpWithEmail,
        signInWithEmail,
        setupRecaptcha,
        currentUser
    } = useAuth();

    const [authMode, setAuthMode] = useState('login');
    const [loginMethod, setLoginMethod] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpSent, setOtpSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // If user is already logged in, redirect
    useEffect(() => {
        if (currentUser) {
            navigate('/');
        }
    }, [currentUser, navigate]);


    useEffect(() => {
        setupRecaptcha('recaptcha-container');
    }, []);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Add country code if not present
            const formattedPhone = phone.startsWith('+') ? phone : `+966${phone}`;
            const confirmation = await sendPhoneOTP(formattedPhone);
            setConfirmationResult(confirmation);
            setOtpSent(true);
        } catch (error) {
            console.error('Error sending OTP:', error);
            setError('فشل إرسال الرمز. تأكد من رقم الجوال وحاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    const handleOTPChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);

            // Auto-focus next input
            if (value && index < 5) {
                document.getElementById(`otp-${index + 1}`)?.focus();
            }
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const code = otp.join('');
        if (code.length === 6) {
            try {
                await verifyPhoneOTP(confirmationResult, code);
                // Navigate to account type selection for new users
                navigate('/select-account-type');
            } catch (error) {
                console.error('Error verifying OTP:', error);
                setError('رمز التحقق غير صحيح. حاول مرة أخرى.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (authMode === 'signup') {
                await signUpWithEmail(email, password, name);
            } else {
                await signInWithEmail(email, password);
            }
            navigate('/select-account-type');
        } catch (error) {
            console.error('Error with email auth:', error);
            if (error.code === 'auth/email-already-in-use') {
                setError('البريد الإلكتروني مستخدم بالفعل');
            } else if (error.code === 'auth/wrong-password') {
                setError('كلمة المرور غير صحيحة');
            } else if (error.code === 'auth/user-not-found') {
                setError('المستخدم غير موجود');
            } else if (error.code === 'auth/weak-password') {
                setError('كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل');
            } else {
                setError('حدث خطأ. حاول مرة أخرى');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        setLoading(true);
        setError('');

        try {
            let result;
            if (provider === 'google') {
                result = await signInWithGoogle();
            } else if (provider === 'apple') {
                result = await signInWithApple();
            }

            if (result && result.isNewUser) {
                navigate('/select-account-type');
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error(`Error with ${provider} login:`, error);
            if (error.code === 'auth/popup-closed-by-user') {
                setError('تم إلغاء تسجيل الدخول');
            } else {
                setError('حدث خطأ في تسجيل الدخول');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1rem',
            fontFamily: 'Inter, sans-serif',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* reCAPTCHA Container */}
            <div id="recaptcha-container"></div>

            {/* Animated Background Elements */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-10%',
                width: '40%',
                height: '40%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'float 6s ease-in-out infinite'
            }}></div>
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-10%',
                width: '50%',
                height: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'float 8s ease-in-out infinite reverse'
            }}></div>

            {/* Main Auth Card */}
            <div style={{
                background: 'white',
                borderRadius: '24px',
                maxWidth: '450px',
                width: '100%',
                padding: '3rem 2.5rem',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                position: 'relative',
                zIndex: 1
            }}>
                {/* Logo & Title */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0.5rem'
                    }}>
                        {authMode === 'login' ? 'مرحباً بعودتك!' : 'انضم إلينا'}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem' }}>
                        {authMode === 'login' ? 'سجل دخولك للمتابعة' : 'أنشئ حساباً جديداً'}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {/* Auth Mode Toggle */}
                <div style={{
                    display: 'flex',
                    background: '#f7fafc',
                    borderRadius: '12px',
                    padding: '4px',
                    marginBottom: '2rem'
                }}>
                    <button
                        onClick={() => {
                            setAuthMode('login');
                            setError('');
                        }}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: authMode === 'login' ? 'white' : 'transparent',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: '600',
                            color: authMode === 'login' ? '#667eea' : '#718096',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            boxShadow: authMode === 'login' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        تسجيل الدخول
                    </button>
                    <button
                        onClick={() => {
                            setAuthMode('signup');
                            setError('');
                        }}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: authMode === 'signup' ? 'white' : 'transparent',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: '600',
                            color: authMode === 'signup' ? '#667eea' : '#718096',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            boxShadow: authMode === 'signup' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        حساب جديد
                    </button>
                </div>

                {/* Login Method Toggle (Phone vs Email) */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.5rem'
                }}>
                    <button
                        onClick={() => {
                            setLoginMethod('phone');
                            setError('');
                        }}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: loginMethod === 'phone' ? '#667eea' : '#e2e8f0',
                            border: 'none',
                            borderRadius: '10px',
                            color: loginMethod === 'phone' ? 'white' : '#4a5568',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.3s'
                        }}
                    >
                        <FaMobileAlt /> رقم الجوال
                    </button>
                    <button
                        onClick={() => {
                            setLoginMethod('email');
                            setError('');
                        }}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: loginMethod === 'email' ? '#667eea' : '#e2e8f0',
                            border: 'none',
                            borderRadius: '10px',
                            color: loginMethod === 'email' ? 'white' : '#4a5568',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.3s'
                        }}
                    >
                        <FaEnvelope /> البريد الإلكتروني
                    </button>
                </div>

                {/* Phone Login */}
                {loginMethod === 'phone' && !otpSent && (
                    <form onSubmit={handleSendOTP}>
                        {authMode === 'signup' && (
                            <div style={{ marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="الاسم الكامل"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '12px',
                                        fontSize: '1rem',
                                        fontFamily: 'inherit',
                                        transition: 'border 0.3s',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        )}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <input
                                type="tel"
                                placeholder="5XXXXXXXX (بدون صفر أو كود الدولة)"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontFamily: 'inherit',
                                    transition: 'border 0.3s',
                                    outline: 'none',
                                    direction: 'ltr',
                                    textAlign: 'right'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem', textAlign: 'right' }}>
                                مثال: 512345678 (سيتم إضافة +966 تلقائياً)
                            </p>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: loading ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '1.05rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'transform 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {loading ? 'جارٍ الإرسال...' : (
                                <>
                                    إرسال رمز التحقق <FaArrowRight style={{ transform: 'rotate(180deg)' }} />
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* OTP Verification */}
                {loginMethod === 'phone' && otpSent && (
                    <form onSubmit={handleVerifyOTP}>
                        <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                            أدخل الرمز المرسل إلى <strong>+966{phone}</strong>
                        </p>
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`otp-${index}`}
                                    type="text"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handleOTPChange(index, e.target.value)}
                                    style={{
                                        width: '50px',
                                        height: '55px',
                                        textAlign: 'center',
                                        fontSize: '1.5rem',
                                        fontWeight: '700',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '12px',
                                        outline: 'none',
                                        transition: 'border 0.3s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            ))}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: loading ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '1.05rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {loading ? 'جارٍ التحقق...' : (
                                <>
                                    <FaCheck /> تأكيد
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setOtpSent(false);
                                setOtp(['', '', '', '', '', '']);
                                setError('');
                            }}
                            type="button"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'transparent',
                                border: 'none',
                                color: '#667eea',
                                fontWeight: '600',
                                cursor: 'pointer',
                                marginTop: '1rem'
                            }}
                        >
                            تغيير رقم الجوال
                        </button>
                    </form>
                )}

                {/* Email Login */}
                {loginMethod === 'email' && (
                    <form onSubmit={handleEmailAuth}>
                        {authMode === 'signup' && (
                            <div style={{ marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="الاسم الكامل"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '12px',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        transition: 'border 0.3s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        )}
                        <div style={{ marginBottom: '1rem' }}>
                            <input
                                type="email"
                                placeholder="example@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    transition: 'border 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <input
                                type="password"
                                placeholder="كلمة المرور (6 أحرف على الأقل)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    transition: 'border 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: loading ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '1.05rem',
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? 'جارٍ...' : (authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب')}
                        </button>
                    </form>
                )}

                {/* Divider */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '2rem 0',
                    gap: '1rem'
                }}>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                    <span style={{ color: '#718096', fontSize: '0.875rem' }}>أو</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                </div>

                {/* Social Login Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                        onClick={() => handleSocialLogin('google')}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '12px',
                            fontWeight: '600',
                            color: '#4a5568',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.3s',
                            opacity: loading ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.background = '#f7fafc';
                                e.currentTarget.style.borderColor = '#cbd5e0';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                    >
                        <FcGoogle size={24} /> المتابعة مع Google
                    </button>

                    <button
                        onClick={() => handleSocialLogin('apple')}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: '#000',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '600',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.3s',
                            opacity: loading ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#1a1a1a')}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
                    >
                        <FaApple size={24} /> المتابعة مع Apple
                    </button>
                </div>

                {/* Terms */}
                <p style={{
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: '#a0aec0',
                    marginTop: '2rem',
                    lineHeight: '1.6'
                }}>
                    بالمتابعة، أنت توافق على <a href="/terms" style={{ color: '#667eea', textDecoration: 'none' }}>الشروط والأحكام</a> و <a href="/privacy" style={{ color: '#667eea', textDecoration: 'none' }}>سياسة الخصوصية</a>
                </p>


            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(20px); }
                }
            `}</style>
        </div>
    );
};

export default AuthPage;
