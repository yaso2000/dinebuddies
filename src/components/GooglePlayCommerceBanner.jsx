import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaGooglePlay } from 'react-icons/fa';
import { AppText } from './base';
import { isGooglePlayCommerce } from '../utils/commercePlatform';
import { isGooglePlayBillingAvailable } from '../utils/googlePlayBillingClient';

export default function GooglePlayCommerceBanner() {
  const { t } = useTranslation();

  if (!isGooglePlayCommerce()) return null;

  const ready = isGooglePlayBillingAvailable();

  return (
    <div
      className={`google-play-commerce-banner${ready ? '' : ' google-play-commerce-banner--warn'}`}
      role="status"
    >
      <FaGooglePlay aria-hidden />
      <AppText as="span">
        {ready
          ? t('google_play_commerce_banner', 'Purchases on Android are billed through Google Play.')
          : t(
              'google_play_commerce_banner_setup',
              'Android app detected — connect Google Play Billing plugin to enable purchases.'
            )}
      </AppText>
    </div>
  );
}
