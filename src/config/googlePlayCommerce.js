/**
 * Google Play in-app product IDs (must match Play Console).
 * Display prices come from Play Billing at runtime on Android; labels here are fallbacks for web preview.
 */

export const GOOGLE_PLAY_PACKAGE_NAME = 'com.dinebuddies.app';

/** @type {Record<string, string>} internal package id → Play product id */
export const GOOGLE_PLAY_CREDIT_SKUS = {
  credits_200: 'dine_credits_200',
  credits_500: 'dine_credits_500',
  credits_1000: 'dine_credits_1000',
  credits_3000: 'dine_credits_3000',
};

export function getGooglePlayProductId(packageId) {
  return GOOGLE_PLAY_CREDIT_SKUS[packageId] || null;
}

export function getGooglePlayProductIdFromPackage(packageId) {
  return getGooglePlayProductId(packageId);
}
