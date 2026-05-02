import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';
import ProSubscription from './business-pro/ProSubscription';
import './SettingsPages.css';

/**
 * Consumer accounts: no subscription tiers — only Dine Credits.
 * Business accounts: Free vs Paid ($29/mo) + link to credits wallet.
 */
const SubscriptionSettings = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile, isBusiness } = useAuth();

    const freeCr = Math.max(0, Number(userProfile?.freeCredits) || 0);
    const paidCr = Math.max(0, Number(userProfile?.paidCredits) || 0);

    return (
        <div className="settings-page">
            <div className="settings-header">
                <button type="button" onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>{t('subscription_billing', 'Subscription & billing')}</h1>
                <div style={{ width: 40 }} />
            </div>

            <div className="settings-content">
                {!isBusiness ? (
                    <div className="settings-card">
                        <h2>{t('your_account', 'Your account')}</h2>
                        <p className="settings-description">
                            {t(
                                'consumer_no_plans',
                                'Personal accounts are free. Invitations, boosts, and most AI use Dine Credits (with a small daily free allowance for text AI).'
                            )}
                        </p>
                        <div style={{ marginTop: 12, fontWeight: 800 }}>
                            {t('credits_balance_short', 'Credits')}: {freeCr + paidCr}{' '}
                            <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                ({t('free', 'free')} {freeCr} + {t('paid', 'paid')} {paidCr})
                            </span>
                        </div>
                        <button
                            type="button"
                            className="my-community-btn my-community-btn--post"
                            style={{ marginTop: 16 }}
                            onClick={() => navigate('/settings/credits')}
                        >
                            {t('open_dine_credits_wallet', 'Dine Credits wallet')}
                        </button>
                    </div>
                ) : (
                    <ProSubscription />
                )}
            </div>
        </div>
    );
};

export default SubscriptionSettings;
