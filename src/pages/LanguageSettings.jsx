import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaGlobe, FaCheck } from 'react-icons/fa';
import { applyHtmlLanguage } from '../utils/authGeoLanguage';
import { LANGUAGE_OPTIONS } from '../constants/languageOptions';
import './SettingsPages.css';

const LanguageSettings = () => {
    const navigate = useNavigate();
    const { i18n, t } = useTranslation();
    const baseLang = i18n.language?.split('-')[0] || 'en';
    const [selectedLanguage, setSelectedLanguage] = useState(baseLang);
    const [success, setSuccess] = useState(false);

    const handleLanguageChange = async (langCode) => {
        setSelectedLanguage(langCode);
        await i18n.changeLanguage(langCode);
        applyHtmlLanguage(langCode);

        try {
            localStorage.setItem('language', langCode);
        } catch {
            /* ignore */
        }

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
                <h1>{t('language_settings_title', 'Language')}</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <FaGlobe style={{ color: '#10b981', fontSize: '1.5rem' }} />
                    </div>

                    <h2>{t('choose_language', 'Choose Language')}</h2>
                    <p className="settings-description">
                        {t('language_settings_description', 'Select your preferred language for the app')}
                    </p>

                    <div className="language-options">
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <button
                                key={lang.code}
                                type="button"
                                className={`language-option ${selectedLanguage === lang.code ? 'active' : ''}`}
                                onClick={() => handleLanguageChange(lang.code)}
                            >
                                <div className="language-flag">{lang.flag}</div>
                                <div className="language-info">
                                    <h3>{t(lang.nameKey, lang.code)}</h3>
                                    <p>{t(lang.nativeKey, lang.code)}</p>
                                </div>
                                {selectedLanguage === lang.code && (
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
                        <strong>{t('note_label', 'Note:')}</strong>{' '}
                        {t('language_settings_restart_note', 'The app will restart to apply the language change.')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LanguageSettings;
