import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaCheckCircle, FaHome, FaCrown } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from "../components/base";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(5);
  const { t } = useTranslation();

  useEffect(() => {
    console.log('Payment Session ID:', sessionId);

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center',
      padding: '40px 20px',
      background: 'var(--bg-body)'
    }}>
            <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '60px 40px',
        maxWidth: '600px',
        boxShadow: '0 10px 50px rgba(139, 92, 246, 0.2)'
      }}>
                <FaCheckCircle style={{
          fontSize: '6rem',
          color: '#10b981',
          marginBottom: '30px',
          animation: 'pulse 2s infinite'
        }} />

                <AppText as="h1" style={{
          fontSize: '2.5rem',
          marginBottom: '15px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
                    {t('subscription_success')}
                </AppText>

                <AppText as="p" style={{
          fontSize: '1.3rem',
          color: 'var(--text-muted)',
          marginBottom: '30px',
          lineHeight: '1.8'
        }}>
                    {t('thank_you_subscription')}<br />
                    {t('plan_activated')}
                </AppText>

                <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px'
        }}>
                    <FaCrown style={{ fontSize: '2rem', color: '#fbbf24', marginBottom: '10px' }} />
                    <AppText as="p" style={{ fontSize: '1.1rem' }}>
                        {t('enjoy_features')}
                    </AppText>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <AppText as="p" style={{ color: 'var(--text-muted)' }}>
                        <AppText as="span" dangerouslySetInnerHTML={{ __html: t('redirect_in_seconds', { count: countdown }) }} />
                    </AppText>
                </div>

                <button
          onClick={() => navigate('/')}
          style={{
            padding: '16px 40px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'transform 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
          
                    <FaHome /> {t('back_to_home')}
                </button>
            </div>
        </div>);

};

export default PaymentSuccess;