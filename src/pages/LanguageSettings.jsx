import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaGlobe, FaCheck } from 'react-icons/fa';
import { APP_LANGUAGES } from '../utils/appLanguages';
import { applyHtmlLanguage } from '../utils/authGeoLanguage';
import './SettingsPages.css';

const LanguageSettings = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');
    const [success, setSuccess] = useState(false);

    const handleLanguageChange = async (langCode) => {
        setSelectedLanguage(langCode);
        await i18n.changeLanguage(langCode);
        applyHtmlLanguage(langCode);

        localStorage.setItem('language', langCode);

        setSuccess(true);
        setTimeout(() => {
            setSuccess(false);
            navigate('/settings');
        }, 1500);
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>{t('language', 'Language')}</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <FaGlobe style={{ color: '#10b981', fontSize: '1.5rem' }} />
                    </div>

                    <h2>{t('language_selector', 'Choose Language')}</h2>
                    <p className="settings-description">
                        {t(
                            'language_settings_desc',
                            'Select your preferred language for the app and AI-generated invitations.'
                        )}
                    </p>

                    <div className="language-options">
                        {APP_LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                className={`language-option ${selectedLanguage === lang.code || selectedLanguage?.startsWith(`${lang.code}-`) ? 'active' : ''}`}
                                onClick={() => handleLanguageChange(lang.code)}
                            >
                                <div className="language-flag">{lang.flag}</div>
                                <div className="language-info">
                                    <h3>{lang.name}</h3>
                                    <p>{lang.nativeName}</p>
                                </div>
                                {(selectedLanguage === lang.code || selectedLanguage?.startsWith(`${lang.code}-`)) && (
                                    <FaCheck className="check-icon" />
                                )}
                            </button>
                        ))}
                    </div>

                    {success && (
                        <div className="success-message">
                            {t('language_changed_success', 'Language changed successfully!')}
                        </div>
                    )}

                    <div className="settings-note">
                        <strong>{t('note', 'Note')}:</strong>{' '}
                        {t(
                            'language_settings_note',
                            'AI text generation uses the language you select here.'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LanguageSettings;
