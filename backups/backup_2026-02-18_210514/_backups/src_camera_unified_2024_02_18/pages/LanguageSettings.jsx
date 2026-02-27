import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaGlobe, FaCheck } from 'react-icons/fa';
import './SettingsPages.css';

const LanguageSettings = () => {
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');
    const [success, setSuccess] = useState(false);

    const languages = [
        {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            flag: '🇬🇧'
        },
        {
            code: 'ar',
            name: 'Arabic',
            nativeName: 'العربية',
            flag: '🇸🇦'
        }
    ];

    const handleLanguageChange = async (langCode) => {
        setSelectedLanguage(langCode);
        await i18n.changeLanguage(langCode);

        // Update HTML dir attribute for RTL support
        document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = langCode;

        // Save to localStorage
        localStorage.setItem('language', langCode);

        setSuccess(true);
        setTimeout(() => {
            setSuccess(false);
            navigate('/settings');
        }, 1500);
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>Language</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <FaGlobe style={{ color: '#10b981', fontSize: '1.5rem' }} />
                    </div>

                    <h2>Choose Language</h2>
                    <p className="settings-description">
                        Select your preferred language for the app
                    </p>

                    <div className="language-options">
                        {languages.map(lang => (
                            <button
                                key={lang.code}
                                className={`language-option ${selectedLanguage === lang.code ? 'active' : ''}`}
                                onClick={() => handleLanguageChange(lang.code)}
                            >
                                <div className="language-flag">{lang.flag}</div>
                                <div className="language-info">
                                    <h3>{lang.name}</h3>
                                    <p>{lang.nativeName}</p>
                                </div>
                                {selectedLanguage === lang.code && (
                                    <FaCheck className="check-icon" />
                                )}
                            </button>
                        ))}
                    </div>

                    {success && (
                        <div className="success-message">
                            Language changed successfully!
                        </div>
                    )}

                    <div className="settings-note">
                        <strong>Note:</strong> The app will restart to apply the language change.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LanguageSettings;
