import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const GuestLoginPrompt = ({ message, icon = '🔒' }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '15px',
            padding: '2rem',
            textAlign: 'center',
            margin: '2rem auto',
            maxWidth: '400px'
        }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>
                {icon}
            </div>
            <h3 style={{
                fontSize: '1.2rem',
                marginBottom: '0.5rem',
                color: 'var(--text-primary)'
            }}>
                {t('login_required')}
            </h3>
            <p style={{
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
                marginBottom: '1.5rem'
            }}>
                {message || t('create_account_enjoy')}
            </p>
            <button
                onClick={() => navigate('/login')}
                style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 2rem',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
                {t('login')}
            </button>
        </div>
    );
};

export default GuestLoginPrompt;
