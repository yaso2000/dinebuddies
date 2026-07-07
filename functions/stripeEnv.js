/**
 * Stripe mode + env price resolution (test vs live via keys or STRIPE_MODE).
 */
const { CREDIT_PACKAGES } = require('./creditsCore');

function stripeSecretKey() {
    return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function isStripeTestMode() {
    const mode = String(process.env.STRIPE_MODE || '').trim().toLowerCase();
    if (mode === 'test') return true;
    if (mode === 'live') return false;
    return stripeSecretKey().startsWith('sk_test_');
}

function listConfiguredCreditPackages() {
    return Object.entries(CREDIT_PACKAGES).map(([packageId, def]) => {
        const priceId = String(process.env[def.envKey] || '').trim();
        return {
            packageId,
            credits: def.credits,
            envKey: def.envKey,
            configured: Boolean(priceId),
        };
    });
}

function stripeCommerceStatus() {
    const businessMonthly = String(process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '').trim();
    return {
        testMode: isStripeTestMode(),
        secretKeyPresent: Boolean(stripeSecretKey()),
        webhookSecretPresent: Boolean(String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()),
        creditPackages: listConfiguredCreditPackages(),
        businessMonthlyConfigured: Boolean(businessMonthly),
    };
}

function stripeCustomerModeLabel() {
    return isStripeTestMode() ? 'test' : 'live';
}

function isStripeCustomerModeMismatchError(error) {
    const msg = String(error?.message || '').toLowerCase();
    return (
        error?.code === 'resource_missing' ||
        msg.includes('test mode') ||
        msg.includes('live mode')
    );
}

module.exports = {
    isStripeTestMode,
    stripeCommerceStatus,
    listConfiguredCreditPackages,
    stripeCustomerModeLabel,
    isStripeCustomerModeMismatchError,
};
