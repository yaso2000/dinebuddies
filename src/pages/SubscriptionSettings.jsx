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
 */import { AppText } from "../components/base";
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
                <AppText as="h1">{t('subscription_billing', 'Subscription & billing')}</AppText>
                <div style={{ width: 40 }} />
            </div>

            <div className="settings-content">
                {!isBusiness ?
        <div className="settings-card">
                        <AppText as="h2">{t('your_account', 'Your account')}</AppText>
                        <AppText as="p" className="settings-description">
                            {t(
              'consumer_no_plans',
              'Your Dine Credits pay for private invites, date invites, AI, and boosts — one balance (free + paid; free is used first). Partners use the same credit model from their wallet. Final per-use prices may be tuned later.'
            )}
                        </AppText>
                        <div style={{ marginTop: 12, fontWeight: 800 }}>
                            {t('credits_balance_short', 'Credits')}: {freeCr + paidCr}{' '}
                            <AppText as="span" style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                ({t('free', 'free')} {freeCr} + {t('paid', 'paid')} {paidCr})
                            </AppText>
                        </div>
                        <button
            type="button"
            className="my-community-btn my-community-btn--post"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/settings/credits')}>
            
                            {t('open_dine_credits_wallet', 'Dine Credits wallet')}
                        </button>
                    </div> :

        <ProSubscription />
        }
            </div>
        </div>);

};

export default SubscriptionSettings;