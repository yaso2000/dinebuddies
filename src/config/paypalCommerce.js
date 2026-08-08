const clientId = String(import.meta.env.VITE_PAYPAL_CLIENT_ID || '').trim();

export const PAYPAL_CLIENT_ID = clientId;
export const PAYPAL_CLIENT_CONFIGURED = Boolean(clientId);

/**
 * AU PayPal business accounts commonly cannot receive USD until enabled.
 * Vercel may still have legacy VITE_PAYPAL_CURRENCY=USD — treat that as AUD unless
 * VITE_PAYPAL_ALLOW_USD=true after USD is enabled on the merchant account.
 */
const rawPayPalCurrency = String(import.meta.env.VITE_PAYPAL_CURRENCY || 'AUD')
  .trim()
  .toUpperCase();
const allowPayPalUsd =
  import.meta.env.VITE_PAYPAL_ALLOW_USD === 'true' ||
  import.meta.env.VITE_PAYPAL_ALLOW_USD === '1';
export const PAYPAL_CURRENCY =
  rawPayPalCurrency === 'USD' && !allowPayPalUsd
    ? 'AUD'
    : rawPayPalCurrency || 'AUD';

export const PAYPAL_TEST_MODE =
  import.meta.env.VITE_PAYPAL_TEST_MODE === 'true' ||
  import.meta.env.VITE_PAYPAL_TEST_MODE === '1' ||
  String(import.meta.env.VITE_PAYPAL_MODE || '').trim().toLowerCase() === 'sandbox';

/** Must match the PayPal Client ID environment (sandbox vs live). */
export const PAYPAL_MODE = PAYPAL_TEST_MODE ? 'sandbox' : 'live';
