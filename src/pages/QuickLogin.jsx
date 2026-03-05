import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FaMobileAlt, FaGoogle, FaFacebook, FaArrowRight, FaCheck, FaEnvelope, FaLock } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useTheme } from '../context/ThemeContext';

const QuickLogin = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { themeMode, isDark } = useTheme();
    const {
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithFacebook,
        continueAsGuest,
        sendPhoneOTP,
        verifyPhoneOTP,
        setupRecaptcha,
        userProfile
    } = useAuth();

    const [loginMethod, setLoginMethod] = useState('phone'); // 'phone', 'email', 'social'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpSent, setOtpSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [justLoggedIn, setJustLoggedIn] = useState(false);

    // After login, redirect business accounts directly to the right dashboard
    useEffect(() => {
        if (justLoggedIn && userProfile) {
            if (userProfile.isBusiness) {
                navigate(window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }
    }, [justLoggedIn, userProfile, navigate]);


    useEffect(() => {
        if (loginMethod === 'phone') {
            setupRecaptcha('recaptcha-container');
        }
    }, [loginMethod]);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isSignUp) {
                await signUpWithEmail(email, password, name);
            } else {
                await signInWithEmail(email, password);
            }
            setJustLoggedIn(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const formattedPhone = phone.startsWith('+') ? phone : `+61${phone}`;
            const confirmation = await sendPhoneOTP(formattedPhone);
            setConfirmationResult(confirmation);
            setOtpSent(true);
        } catch (error) {
            console.error('Error sending OTP:', error);
            setError(t('failed_send_code', 'Failed to send code. Check your number.'));
        } finally {
            setLoading(false);
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
                setJustLoggedIn(true);
            } catch (error) {
                setError(t('invalid_code', 'Invalid code. Please try again.'));
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSocialLogin = async (provider) => {
        setLoading(true);
        setError('');
        try {
            let result;
            if (provider === 'google') result = await signInWithGoogle();
            else if (provider === 'facebook') result = await signInWithFacebook();

            if (result?.user) {
                setJustLoggedIn(true);
            }
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOTPChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);
            if (value && index < 5) {
                document.getElementById(`otp-${index + 1}`)?.focus();
            }
        }
    };

    const isRTL = i18n.language === 'ar';

    return (
        <div style={{
            height: '100dvh',
            background: 'var(--bg-body)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-body)',
            overflowY: 'auto',
            padding: '1.5rem'
        }}>
            <div id="recaptcha-container"></div>

            <div className="glass-card" style={{
                margin: 'auto',
                maxWidth: '420px',
                width: '100%',
                padding: '2.5rem',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                flexShrink: 0
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                        <div
                            aria-label="DineBuddies Logo"
                            style={{
                                width: '80px',
                                height: '80px',
                                WebkitMaskImage: `url(${isDark ? "/logo-w.png" : "/logo.png"})`,
                                WebkitMaskSize: 'contain',
                                WebkitMaskPosition: 'center',
                                WebkitMaskRepeat: 'no-repeat',
                                maskImage: `url(${isDark ? "/logo-w.png" : "/logo.png"})`,
                                maskSize: 'contain',
                                maskPosition: 'center',
                                maskRepeat: 'no-repeat',
                                backgroundColor: isDark ? '#ffffff' : '#f97316',
                                filter: isDark ? 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.3))' : 'none',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    </div>
                    <h1
                        className="app-name"
                        style={{
                            fontSize: '1.8rem',
                            fontWeight: '900',
                            margin: 0,
                            color: isDark ? '#ffffff' : '#f97316',
                            transition: 'color 0.3s ease',
                            letterSpacing: '-1px'
                        }}
                    >
                        DineBuddies
                    </h1>
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.95rem',
                        marginTop: '0.5rem',
                        fontWeight: '500'
                    }}>
                        {t('join_community', 'Join the community')}
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        marginBottom: '1.5rem',
                        fontSize: '0.85rem',
                        textAlign: 'center',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        {error}
                    </div>
                )}

                {/* Login Method Tabs */}
                <div className="auth-tabs" style={{
                    display: 'flex',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '4px',
                    borderRadius: '14px',
                    marginBottom: '1.5rem'
                }}>
                    <button
                        onClick={() => { setLoginMethod('phone'); setOtpSent(false); }}
                        className={`auth-tab-btn ${loginMethod === 'phone' ? 'active' : ''}`}
                    >
                        {t('phone', 'Phone')}
                    </button>
                    <button
                        onClick={() => setLoginMethod('email')}
                        className={`auth-tab-btn ${loginMethod === 'email' ? 'active' : ''}`}
                    >
                        {t('email', 'Email')}
                    </button>
                    <button
                        onClick={() => setLoginMethod('social')}
                        className={`auth-tab-btn ${loginMethod === 'social' ? 'active' : ''}`}
                    >
                        {t('social', 'Social')}
                    </button>
                </div>

                {/* Phone Login */}
                {loginMethod === 'phone' && (
                    !otpSent ? (
                        <form onSubmit={handleSendOTP}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600' }}>
                                    {t('phone_number', 'Phone Number')}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <FaMobileAlt style={{ position: 'absolute', left: isRTL ? 'auto' : '1rem', right: isRTL ? '1rem' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="tel"
                                        placeholder="04xx xxx xxx"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: isRTL ? '12px 2.5rem 12px 1rem' : '12px 1rem 12px 2.5rem',
                                            borderRadius: '12px',
                                            background: 'var(--bg-input)',
                                            border: '1px solid var(--border-color)',
                                            color: 'white',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, var(--primary), #ea580c)',
                                    color: 'white',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontSize: '1rem'
                                }}
                            >
                                {loading ? t('loading', 'Loading...') : (
                                    <>
                                        {t('send_code', 'Send Verification Code')}
                                        <FaArrowRight style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOTP}>
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                {t('enter_code_sent', 'Enter the code sent to')} <strong>+61{phone}</strong>
                            </p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.5rem', direction: 'ltr' }}>
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        id={`otp-${index}`}
                                        type="text"
                                        maxLength="1"
                                        value={digit}
                                        onChange={(e) => handleOTPChange(index, e.target.value)}
                                        style={{
                                            width: '45px',
                                            height: '50px',
                                            textAlign: 'center',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            borderRadius: '10px',
                                            background: 'var(--bg-input)',
                                            border: '2px solid var(--border-color)',
                                            color: 'white',
                                            outline: 'none'
                                        }}
                                    />
                                ))}
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, var(--primary), #ea580c)',
                                    color: 'white',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {loading ? t('verifying', 'Verifying...') : (
                                    <>
                                        <FaCheck /> {t('verify_and_login', 'Verify & Login')}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setOtpSent(false)}
                                style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--primary)', marginTop: '1rem', cursor: 'pointer', fontWeight: '600' }}
                            >
                                {t('change_number', 'Change phone number')}
                            </button>
                        </form>
                    )
                )}

                {/* Email Login */}
                {loginMethod === 'email' && (
                    <form onSubmit={handleEmailSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={{ position: 'absolute', left: isRTL ? 'auto' : '1rem', right: isRTL ? '1rem' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="email"
                                    placeholder={t('email', 'Email Address')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: isRTL ? '12px 2.5rem 12px 1rem' : '12px 1rem 12px 2.5rem',
                                        borderRadius: '12px',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        color: 'white',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ position: 'relative' }}>
                                <FaLock style={{ position: 'absolute', left: isRTL ? 'auto' : '1rem', right: isRTL ? '1rem' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="password"
                                    placeholder={t('password', 'Password')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: isRTL ? '12px 2.5rem 12px 1rem' : '12px 1rem 12px 2.5rem',
                                        borderRadius: '12px',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        color: 'white',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '14px',
                                border: 'none',
                                background: 'linear-gradient(135deg, var(--primary), #ea580c)',
                                color: 'white',
                                fontWeight: '800',
                                cursor: 'pointer',
                                fontSize: '1rem'
                            }}
                        >
                            {loading ? t('loading', 'Loading...') : (isSignUp ? t('create_account', 'Create Account') : t('login', 'Login'))}
                        </button>
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
                            >
                                {isSignUp ? t('have_account', 'Already have an account? Login') : t('no_account', "Don't have an account? Sign up")}
                            </button>
                        </div>
                    </form>
                )}

                {/* Social Login */}
                {loginMethod === 'social' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            onClick={() => handleSocialLogin('google')}
                            className="btn-auth-social btn-google"
                        >
                            <FcGoogle size={24} />
                            {t('continue_with_google', 'Continue with Google')}
                        </button>
                        <button
                            onClick={() => handleSocialLogin('facebook')}
                            className="btn-auth-social btn-facebook"
                        >
                            <FaFacebook size={24} />
                            {t('continue_with_facebook', 'Continue with Facebook')}
                        </button>
                    </div>
                )}

                {/* Guest & Business */}
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        onClick={() => { continueAsGuest(); navigate('/'); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
                    >
                        {t('continue_as_guest', '👤 Continue as Guest')}
                    </button>

                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                            {t('are_you_business', 'Are you a business owner?')}
                        </p>
                        <button
                            onClick={() => navigate('/business/signup')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '10px',
                                borderRadius: '12px',
                                background: 'rgba(139, 92, 246, 0.1)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                color: '#a78bfa',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            🏪 {t('create_business_account', 'Create Business Account')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickLogin;
