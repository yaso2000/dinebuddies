import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useToast } from '../context/ToastContext';
import { getCommercePlatform, isGooglePlayCommerce, COMMERCE_PLATFORM } from '../utils/commercePlatform';
import {
  isGooglePlayBillingAvailable,
  purchaseCreditPackViaGooglePlay,
} from '../utils/googlePlayBillingClient';

const FUNCTIONS_REGION = 'us-central1';

export function useCreditsPurchase() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loadingId, setLoadingId] = useState(null);

  const platform = useMemo(() => getCommercePlatform(), []);
  const googlePlayReady = isGooglePlayCommerce() && isGooglePlayBillingAvailable();

  const buyPack = useCallback(
    async (pack) => {
      setLoadingId(pack.id);
      try {
        if (platform === COMMERCE_PLATFORM.GOOGLE_PLAY) {
          if (!isGooglePlayBillingAvailable()) {
            showToast(
              t(
                'google_play_billing_plugin_missing',
                'Google Play billing is not ready in this build. Reinstall the Android app from Play internal testing.'
              ),
              'error'
            );
            return;
          }

          const result = await purchaseCreditPackViaGooglePlay(pack);
          showToast(
            t('google_play_credits_added', '{{count}} credits added to your wallet.', {
              count: result.credits,
            }),
            'success'
          );
          return;
        }

        const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'createCreditsCheckoutSession');
        const origin = window.location.origin;
        const result = await fn({
          packageId: pack.id,
          successUrl: `${origin}/settings/credits?purchase=success`,
          cancelUrl: `${origin}/settings/credits`,
        });
        const url = result.data?.url;
        if (url) window.location.href = url;
      } catch (e) {
        console.error('[useCreditsPurchase]', e);
        const msg =
          e?.message ||
          e?.details ||
          (platform === COMMERCE_PLATFORM.GOOGLE_PLAY
            ? t('google_play_purchase_failed', 'Google Play purchase could not be completed.')
            : t('checkout_start_failed', 'Could not start checkout. Check Stripe functions config.'));
        showToast(msg, 'error');
      } finally {
        setLoadingId(null);
      }
    },
    [platform, showToast, t]
  );

  return {
    buyPack,
    loadingId,
    platform,
    isGooglePlay: platform === COMMERCE_PLATFORM.GOOGLE_PLAY,
    googlePlayReady,
  };
}
