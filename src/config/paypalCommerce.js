const clientId = String(import.meta.env.VITE_PAYPAL_CLIENT_ID || '').trim();

export const PAYPAL_CLIENT_ID = clientId;
export const PAYPAL_CLIENT_CONFIGURED = Boolean(clientId);
export const PAYPAL_CURRENCY = String(import.meta.env.VITE_PAYPAL_CURRENCY || 'USD')
  .trim()
  .toUpperCase();

export const PAYPAL_TEST_MODE =
  import.meta.env.VITE_PAYPAL_TEST_MODE === 'true' ||
  import.meta.env.VITE_PAYPAL_TEST_MODE === '1' ||
  String(import.meta.env.VITE_PAYPAL_MODE || '').trim().toLowerCase() === 'sandbox';
