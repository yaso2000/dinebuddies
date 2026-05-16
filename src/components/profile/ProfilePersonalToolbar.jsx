import React, { memo } from 'react';
import { FaQuestionCircle, FaCog, FaSun, FaMoon } from 'react-icons/fa';

function ProfilePersonalToolbar({ isOwnProfile, navigate, t, isDark, toggleTheme }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0.5rem 0', gap: '10px' }}>
            {isOwnProfile && (
                <button
                    type="button"
                    className="profile-top-btn"
                    onClick={() => navigate('/support')}
                    title={t('faq.title', 'Help & Support')}
                    style={{
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                >
                    <FaQuestionCircle size={18} />
                </button>
            )}
            {isOwnProfile && (
                <button
                    type="button"
                    className="profile-top-btn"
                    onClick={() => navigate('/settings')}
                    title={t('settings')}
                    style={{
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                >
                    <FaCog size={18} />
                </button>
            )}
            <button
                type="button"
                onClick={toggleTheme}
                className="profile-theme-toggle"
                style={{ color: isDark ? 'var(--luxury-gold)' : 'var(--primary)', marginLeft: '4px' }}
            >
                {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
            </button>
        </div>
    );
}

export default memo(ProfilePersonalToolbar);
