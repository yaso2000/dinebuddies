import React from 'react';
import AppBackButton from '../components/AppBackButton';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';
import ProSubscription from './business-pro/ProSubscription';
import { getPurchaseCredits, getSavedCredits } from '../utils/walletCredits';
import './SettingsPages.css';

/**
 * Consumer accounts: purchase + savings wallets.
 * Business accounts: Free vs Paid ($29/mo) + link to credits wallet.
 */
import { AppText } from "../components/base";
const SubscriptionSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile, isBusiness } = useAuth();

  const purchaseCr = getPurchaseCredits(userProfile);
  const savedCr = getSavedCredits(userProfile);

  return (
    <div className="settings-page">
            <div className="settings-header">
                <AppBackButton fallback="/settings" />
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
              'Your purchase wallet pays for private invites, AI, boosts, and sending gifts. Gifts you receive accumulate in your savings wallet at half the sent value — the two never mix.'
            )}
                        </AppText>
                        <div style={{ marginTop: 12, fontWeight: 800 }}>
                            {t('purchase_wallet_title', 'Purchase wallet')}: {purchaseCr}{' '}
                            <AppText as="span" style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                · {t('savings_wallet_title', 'Savings wallet')}: {savedCr}
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
