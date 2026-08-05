/**
 * Payment channel: Stripe on web, Google Play on native Android shell (Capacitor/TWA).
 */

export const COMMERCE_PLATFORM = {
  STRIPE: 'stripe',
  GOOGLE_PLAY: 'google_play',
};

export function getCommercePlatform() {
  if (typeof window === 'undefined') return COMMERCE_PLATFORM.STRIPE;

  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android') {
    return COMMERCE_PLATFORM.GOOGLE_PLAY;
  }

  return COMMERCE_PLATFORM.STRIPE;
}

export function isGooglePlayCommerce() {
  return getCommercePlatform() === COMMERCE_PLATFORM.GOOGLE_PLAY;
}

export function isStripeCommerce() {
  return getCommercePlatform() === COMMERCE_PLATFORM.STRIPE;
}
