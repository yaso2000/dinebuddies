/**
 * iOS native billing bridge.
 * Expects a Capacitor plugin registered as `AppleStoreBilling` (see ios/App/App/AppleStoreBillingPlugin.swift).
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import {
  getAppleStoreProductId,
  APPLE_STORE_BUSINESS_SUBSCRIPTION_PRODUCT_ID,
} from '../config/appStoreCommerce';

const FUNCTIONS_REGION = 'us-central1';

function getBillingPlugin() {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.AppleStoreBilling || null;
}

export function isAppleStoreBillingAvailable() {
  return Boolean(getBillingPlugin()?.launchBillingFlow);
}

/**
 * @param {{ id: string }} pack — Dine credit pack (credits_200, …)
 * @returns {Promise<{ credits: number, packageId: string }>}
 */
export async function purchaseCreditPackViaAppleStore(pack) {
  const plugin = getBillingPlugin();
  const productId = getAppleStoreProductId(pack?.id);

  if (!plugin?.launchBillingFlow) {
    const err = new Error('APPLE_STORE_BILLING_UNAVAILABLE');
    err.code = 'APPLE_STORE_BILLING_UNAVAILABLE';
    throw err;
  }

  if (!productId) {
    const err = new Error('UNKNOWN_APPLE_STORE_PRODUCT');
    err.code = 'UNKNOWN_APPLE_STORE_PRODUCT';
    throw err;
  }

  const purchaseResult = await plugin.launchBillingFlow({ productId });
  const signedTransactionInfo = purchaseResult?.signedTransactionInfo;

  if (!signedTransactionInfo) {
    const err = new Error('APPLE_STORE_NO_SIGNED_TRANSACTION');
    err.code = 'APPLE_STORE_NO_SIGNED_TRANSACTION';
    throw err;
  }

  const verifyFn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'verifyAppleCreditsPurchase');
  const { data } = await verifyFn({ productId, signedTransactionInfo });
  return {
    credits: data?.credits,
    packageId: data?.packageId || pack.id,
    alreadyFulfilled: Boolean(data?.alreadyFulfilled),
  };
}

/**
 * @returns {Promise<{ paidUntil: string }>}
 */
export async function purchaseBusinessSubscriptionViaAppleStore() {
  const plugin = getBillingPlugin();

  if (!plugin?.launchBillingFlow) {
    const err = new Error('APPLE_STORE_BILLING_UNAVAILABLE');
    err.code = 'APPLE_STORE_BILLING_UNAVAILABLE';
    throw err;
  }

  const purchaseResult = await plugin.launchBillingFlow({
    productId: APPLE_STORE_BUSINESS_SUBSCRIPTION_PRODUCT_ID,
  });
  const signedTransactionInfo = purchaseResult?.signedTransactionInfo;

  if (!signedTransactionInfo) {
    const err = new Error('APPLE_STORE_NO_SIGNED_TRANSACTION');
    err.code = 'APPLE_STORE_NO_SIGNED_TRANSACTION';
    throw err;
  }

  const verifyFn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'verifyAppleBusinessSubscription');
  const { data } = await verifyFn({ signedTransactionInfo });
  return { paidUntil: data?.paidUntil || null };
}

/**
 * Apple review (Guideline 3.1.2) requires a restore-purchases affordance for
 * renewable subscriptions — re-syncs StoreKit's local entitlement state and,
 * if an active Business subscription is found, re-verifies it server-side.
 * @returns {Promise<{ paidUntil: string | null, restored: boolean }>}
 */
export async function restoreBusinessSubscriptionViaAppleStore() {
  const plugin = getBillingPlugin();

  if (!plugin?.restorePurchases) {
    const err = new Error('APPLE_STORE_BILLING_UNAVAILABLE');
    err.code = 'APPLE_STORE_BILLING_UNAVAILABLE';
    throw err;
  }

  let restoreResult;
  try {
    restoreResult = await plugin.restorePurchases();
  } catch (e) {
    if (e?.code === 'NO_ACTIVE_SUBSCRIPTION') {
      return { paidUntil: null, restored: false };
    }
    throw e;
  }

  const signedTransactionInfo = restoreResult?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    return { paidUntil: null, restored: false };
  }

  const verifyFn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'verifyAppleBusinessSubscription');
  const { data } = await verifyFn({ signedTransactionInfo });
  return { paidUntil: data?.paidUntil || null, restored: true };
}
