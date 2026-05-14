const assert = require('assert');
const {
    findByPlanId,
    findByPriceId,
    isExpectedPriceForProduct,
    resolveCheckoutProduct,
} = require('./paymentPlans');

const originalEnv = { ...process.env };

try {
    process.env.STRIPE_PRICE_BUSINESS_ELITE = 'price_server_elite';

    const byAlias = resolveCheckoutProduct({
        planId: 'p5',
        priceId: 'price_cheap_attacker_supplied',
    });
    assert.strictEqual(byAlias.planId, 'elite');
    assert.strictEqual(byAlias.priceId, 'price_server_elite');

    const byPrice = findByPriceId('price_server_elite');
    assert.strictEqual(byPrice.planId, 'elite');

    assert.strictEqual(findByPlanId('not-a-plan'), null);
    assert.strictEqual(isExpectedPriceForProduct(byAlias, ['price_cheap_attacker_supplied']), false);
    assert.strictEqual(isExpectedPriceForProduct(byAlias, ['price_server_elite']), true);
} finally {
    process.env = originalEnv;
}

