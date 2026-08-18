/**
 * Payment channel: Stripe/PayPal on web, Google Play on native Android shell,
 * Apple In-App Purchase on native iOS shell (Capacitor).
 */

export const COMMERCE_PLATFORM = {
  STRIPE: 'stripe',
  GOOGLE_PLAY: 'google_play',
  APPLE_STORE: 'apple_store',
};

export function getCommercePlatform() {
  if (typeof window === 'undefined') return COMMERCE_PLATFORM.STRIPE;

  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) {
    const platform = cap.getPlatform?.();
    if (platform === 'android') return COMMERCE_PLATFORM.GOOGLE_PLAY;
    if (platform === 'ios') return COMMERCE_PLATFORM.APPLE_STORE;
  }

  return COMMERCE_PLATFORM.STRIPE;
}

export function isGooglePlayCommerce() {
  return getCommercePlatform() === COMMERCE_PLATFORM.GOOGLE_PLAY;
}

export function isAppleStoreCommerce() {
  return getCommercePlatform() === COMMERCE_PLATFORM.APPLE_STORE;
}

export function isStripeCommerce() {
  return getCommercePlatform() === COMMERCE_PLATFORM.STRIPE;
}
