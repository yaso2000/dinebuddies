import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMobileAlt, FaFacebook, FaTwitter, FaApple, FaCheck, FaArrowRight } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const AuthPage = () => {
    const navigate = useNavigate();
    const {
        sendPhoneOTP,
        verifyPhoneOTP,
        signInWithGoogle,
        signInWithApple,
        signInWithFacebook,
        signInWithTwitter,
        setupRecaptcha,
        currentUser,
        continueAsGuest
    } = useAuth();
    const { t } = useTranslation();

    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpSent, setOtpSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState(null);
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
            setError(t('failed_send_code'));
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
                navigate('/');
            } catch (error) {
                console.error('Error verifying OTP:', error);
                setError(t('invalid_verification_code'));
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
            if (provider === 'google') {
                result = await signInWithGoogle();
            } else if (provider === 'apple') {
                result = await signInWithApple();
            } else if (provider === 'facebook') {
                result = await signInWithFacebook();
            } else if (provider === 'twitter') {
                result = await signInWithTwitter();
            }

            if (result) {
                navigate('/');
            }
        } catch (error) {
            console.error(`Error with ${provider} login:`, error);
            if (error.code === 'auth/popup-closed-by-user') {
                setError(t('login_cancelled'));
            } else {
                setError(t('login_error'));
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
                        DineBuddies
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem' }}>
                        {t('join_us')}
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

                {/* Phone Login Form */}
                {!otpSent ? (
                    <form onSubmit={handleSendOTP}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#4a5568' }}>
                                {t('phone_number')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FaMobileAlt style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0' }} />
                                <input
                                    type="tel"
                                    placeholder={t('phone_placeholder')} // "5xxxxxxxx"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1rem 1rem 1rem 2.5rem',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '12px',
                                        fontSize: '1rem',
                                        fontFamily: 'inherit',
                                        transition: 'border 0.3s',
                                        outline: 'none',
                                        direction: 'ltr',
                                        textAlign: 'left' // English LTR for phone numbers usually better
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem', textAlign: 'right' }}>
                                {t('phone_example')}
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
                            {loading ? t('sending') : (
                                <>
                                    {t('send_verification_code')} <FaArrowRight style={{ transform: 'rotate(180deg)' }} />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOTP}>
                        <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                            {t('code_sent_to')} <strong>+966{phone}</strong>
                        </p>
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            marginBottom: '1.5rem',
                            direction: 'ltr'
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
                                        width: '45px',
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
                            {loading ? t('verifying') : (
                                <>
                                    <FaCheck /> {t('confirm')}
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
                            {t('change_phone_number')}
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
                    <span style={{ color: '#718096', fontSize: '0.875rem' }}>{t('or')}</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                </div>

                {/* Social Login Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <button
                        onClick={() => handleSocialLogin('google')}
                        disabled={loading}
                        style={{
                            padding: '0.75rem',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            fontWeight: '600',
                            color: '#4a5568',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FcGoogle size={20} /> <span style={{ fontSize: '0.9rem' }}>Google</span>
                    </button>

                    {/* <button
                        onClick={() => handleSocialLogin('apple')}
                        disabled={loading}
                        style={{
                            padding: '0.75rem',
                            background: '#000',
                            border: '1px solid #000',
                            borderRadius: '12px',
                            fontWeight: '600',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaApple size={20} /> <span style={{ fontSize: '0.9rem' }}>Apple</span>
                    </button> */}

                    <button
                        onClick={() => handleSocialLogin('facebook')}
                        disabled={loading}
                        style={{
                            padding: '0.75rem',
                            background: '#1877F2',
                            border: '1px solid #1877F2',
                            borderRadius: '12px',
                            fontWeight: '600',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaFacebook size={20} /> <span style={{ fontSize: '0.9rem' }}>Facebook</span>
                    </button>

                    {/* <button
                        onClick={() => handleSocialLogin('twitter')}
                        disabled={loading}
                        style={{
                            padding: '0.75rem',
                            background: '#14171a',
                            border: '1px solid #14171a',
                            borderRadius: '12px',
                            fontWeight: '600',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaTwitter size={20} /> <span style={{ fontSize: '0.9rem' }}>Twitter</span>
                    </button> */}
                </div>

                {/* Continue as Guest */}
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                        onClick={() => {
                            continueAsGuest();
                            navigate('/');
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontWeight: '600',
                            color: '#718096',
                            cursor: 'pointer',
                            transition: 'color 0.3s',
                            fontSize: '0.9rem',
                            textDecoration: 'underline'
                        }}
                    >
                        {t('continue_as_guest', { defaultValue: '👤 Continue as Guest' })}
                    </button>
                </div>

                {/* Terms */}
                <p style={{
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: '#a0aec0',
                    marginTop: '1.5rem',
                    lineHeight: '1.6'
                }}>
                    {t('terms_agreement')}
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
