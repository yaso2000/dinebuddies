/**
 * Apple App Store product ids — mirrors src/config/googlePlayCommerce.js.
 * Must exactly match the product ids created in App Store Connect.
 */

export const APPLE_STORE_BUNDLE_ID = 'com.dinebuddies.app';

export const APPLE_STORE_CREDIT_PRODUCTS = {
  credits_200: 'com.dinebuddies.app.credits_200',
  credits_500: 'com.dinebuddies.app.credits_500',
  credits_1000: 'com.dinebuddies.app.credits_1000',
  credits_3000: 'com.dinebuddies.app.credits_3000',
};

export const APPLE_STORE_BUSINESS_SUBSCRIPTION_PRODUCT_ID = 'com.dinebuddies.app.business_monthly';

export function getAppleStoreProductId(packageId) {
  return APPLE_STORE_CREDIT_PRODUCTS[packageId] || null;
}
