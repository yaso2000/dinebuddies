/**
 * Client display + helpers for Stripe commerce (prices come from Stripe; labels for test AUD packs).
 */

const publishableKey = String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();

export const STRIPE_PUBLISHABLE_CONFIGURED = Boolean(publishableKey);

export const STRIPE_TEST_MODE =
    import.meta.env.VITE_STRIPE_TEST_MODE === 'true' ||
    import.meta.env.VITE_STRIPE_TEST_MODE === '1' ||
    publishableKey.startsWith('pk_test_');

/** @type {{ id: string, credits: number, priceLabel: string, sub?: string, highlight?: boolean }[]} */
export const DINE_CREDIT_PACKS = STRIPE_TEST_MODE
    ? [
          { id: 'credits_200', credits: 200, priceLabel: 'A$2' },
          { id: 'credits_500', credits: 500, priceLabel: 'A$5' },
          { id: 'credits_1000', credits: 1000, priceLabel: 'A$10' },
          {
              id: 'credits_3000',
              credits: 3000,
              priceLabel: 'A$25',
              sub: 'Best value',
              highlight: true,
          },
      ]
    : [
          { id: 'credits_200', credits: 200, priceLabel: '$2' },
          { id: 'credits_500', credits: 500, priceLabel: '$5' },
          { id: 'credits_1000', credits: 1000, priceLabel: '$10' },
          {
              id: 'credits_3000',
              credits: 3000,
              priceLabel: '$25',
              sub: 'Best value',
              highlight: true,
          },
      ];

export const BUSINESS_PAID_PLAN_DISPLAY = STRIPE_TEST_MODE
    ? { priceLabel: 'A$20', periodLabel: '/month', name: 'paid plan test' }
    : { priceLabel: '$29', periodLabel: '/month', name: 'Paid Business' };
