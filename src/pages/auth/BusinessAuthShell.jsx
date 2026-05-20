import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft } from 'react-icons/fa';
import AuthPageChrome from './AuthPageChrome';

/**
 * Same visual environment as {@link LoginHub}: full-page auth layer, brand header, card.
 * Use for business-only flows (e.g. new business registration).
 */
export default function BusinessAuthShell({ children }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="auth-route-scroll login-hub login-hub-page">
            <div className="login-hub-wrap login-hub-wrap--business-signup">
                <AuthPageChrome
                    accountTab="business"
                    onSwitchToPersonal={() => navigate('/login', { replace: true })}
                    showAffiliateLink
                />
                <div className="login-hub-business-banner">
                    <button
                        type="button"
                        className="login-hub-banner-back"
                        onClick={() => navigate('/login?tab=business')}
                    >
                        <FaArrowLeft aria-hidden />
                        {t('business_auth_back_to_signin', 'Back to business sign-in')}
                    </button>
                </div>

                <div className="login-hub-card login-hub-card--business-signup">
                    <div className="login-hub-tabpanel business-signup-form">{children}</div>
                </div>
            </div>
        </div>
    );
}
