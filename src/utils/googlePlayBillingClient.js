/**
 * Android native billing bridge.
 * Expects a Capacitor plugin registered as `GooglePlayBilling` (see docs/GOOGLE_PLAY_ANDROID.md).
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { getGooglePlayProductId } from '../config/googlePlayCommerce';

const FUNCTIONS_REGION = 'us-central1';

function getBillingPlugin() {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.GooglePlayBilling || null;
}

export function isGooglePlayBillingAvailable() {
  return Boolean(getBillingPlugin()?.launchBillingFlow);
}

/**
 * @param {{ id: string }} pack — Dine credit pack (credits_200, …)
 * @returns {Promise<{ credits: number, packageId: string }>}
 */
export async function purchaseCreditPackViaGooglePlay(pack) {
  const plugin = getBillingPlugin();
  const productId = getGooglePlayProductId(pack?.id);

  if (!plugin?.launchBillingFlow) {
    const err = new Error('GOOGLE_PLAY_BILLING_UNAVAILABLE');
    err.code = 'GOOGLE_PLAY_BILLING_UNAVAILABLE';
    throw err;
  }

  if (!productId) {
    const err = new Error('UNKNOWN_GOOGLE_PLAY_PRODUCT');
    err.code = 'UNKNOWN_GOOGLE_PLAY_PRODUCT';
    throw err;
  }

  const billingResult = await plugin.launchBillingFlow({ productId });
  const purchaseToken =
    billingResult?.purchaseToken ||
    billingResult?.token ||
    billingResult?.purchase?.purchaseToken;

  if (!purchaseToken) {
    const err = new Error('GOOGLE_PLAY_NO_PURCHASE_TOKEN');
    err.code = 'GOOGLE_PLAY_NO_PURCHASE_TOKEN';
    throw err;
  }

  const verifyFn = httpsCallable(
    getFunctions(app, FUNCTIONS_REGION),
    'verifyGooglePlayCreditsPurchase'
  );

  const { data } = await verifyFn({ productId, purchaseToken });
  return {
    credits: data?.credits,
    packageId: data?.packageId || pack.id,
    alreadyFulfilled: Boolean(data?.alreadyFulfilled),
  };
}
