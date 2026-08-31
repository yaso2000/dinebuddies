import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { getBusinessProAccess } from '../../utils/businessSubscription';
import BusinessPaidFeatureGate from '../../components/business/BusinessPaidFeatureGate';
import BusinessSwipeSpecialOfferEditor from '../../components/business/BusinessSwipeSpecialOfferEditor';
import { AppText } from '../../components/base';
import '../../components/business/BusinessSwipeSpecialOfferEditor.css';
import './CreateSwipeSpecialOffer.css';

/**
 * Paid Business: create/edit the special offer shown on partner swipe cards.
 * Entry: business + create sheet.
 */
export default function CreateSwipeSpecialOffer() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const tier = getBusinessProAccess(userProfile);

  if (!tier.canUseSwipeSpecialOffer) {
    return (
      <BusinessPaidFeatureGate
        titleKey="swipe_offer_paid_only"
        titleDefault="Swipe special offers require Paid Business"
        hintKey="swipe_offer_paid_hint"
        hintDefault="Upgrade to publish a special offer on your partner swipe card."
      />
    );
  }

  return (
    <div className="swipe-offer-page">
      <header className="app-header sticky-header-glass swipe-offer-page__header">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate(-1)}
          aria-label={t('back', 'Back')}
        >
          <FaArrowLeft
            style={{
              transform: i18n.dir() === 'rtl' ? 'rotate(180deg)' : undefined,
            }}
          />
        </button>
        <AppText as="h3" className="swipe-offer-page__title">
          {t('business_create_offer_title', 'Special offer')}
        </AppText>
        <div className="swipe-offer-page__header-spacer" aria-hidden />
      </header>

      <div className="swipe-offer-page__body">
        <BusinessSwipeSpecialOfferEditor showHeading={false} />
      </div>
    </div>
  );
}
