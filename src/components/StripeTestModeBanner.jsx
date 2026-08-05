import React from 'react';
import { useTranslation } from 'react-i18next';
import { STRIPE_TEST_MODE } from '../config/stripeCommerce';

/** Shown on billing screens when pk_test / VITE_STRIPE_TEST_MODE is active. */
export default function StripeTestModeBanner() {
    const { t } = useTranslation();
    if (!STRIPE_TEST_MODE) return null;

    return (
        <div className="stripe-test-banner" role="status" aria-live="polite">
            {t(
                'stripe_test_mode_banner',
                'Stripe test mode — use card 4242 4242 4242 4242. No real charges.'
            )}
        </div>
    );
}
