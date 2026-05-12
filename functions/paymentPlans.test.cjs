const test = require('node:test');
const assert = require('node:assert/strict');

for (const key of [
    'STRIPE_PRICE_USER_PRO',
    'STRIPE_PRICE_USER_PREMIUM',
    'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
    'STRIPE_PRICE_BUSINESS_ELITE',
    'STRIPE_PRICE_OFFER_SLOT_50H',
]) {
    delete process.env[key];
}

const {
    resolveCheckoutProduct,
    findByPlanId,
    findByPriceId,
    isExpectedPriceForProduct,
} = require('./paymentPlans');

test('canonicalizes legacy plan ids used by the pricing UI', () => {
    assert.equal(resolveCheckoutProduct({ planId: 'p2' }).planId, 'pro');
    assert.equal(resolveCheckoutProduct({ planId: 'p3' }).planId, 'premium');
    assert.equal(resolveCheckoutProduct({ planId: 'p4' }).planId, 'professional');
    assert.equal(resolveCheckoutProduct({ planId: 'p5' }).planId, 'elite');
});

test('uses the server-owned plan price when client price and plan disagree', () => {
    const product = resolveCheckoutProduct({
        planId: 'elite',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
    });

    assert.equal(product.planId, 'elite');
    assert.equal(product.priceId, 'price_1T4DlqKpQn3RDJUC6vrueW0n');
});

test('can resolve a known product from price id for legacy callers', () => {
    const product = findByPriceId('price_1T4DrkKpQn3RDJUC7cPercNu');

    assert.equal(product.planId, 'premium');
    assert.equal(product.weeklyQuota, -1);
});

test('webhook price check rejects mismatched paid price ids', () => {
    const elite = findByPlanId('elite');

    assert.equal(isExpectedPriceForProduct(elite, ['price_1T4DlqKpQn3RDJUC6vrueW0n']), true);
    assert.equal(isExpectedPriceForProduct(elite, ['price_1T4DptKpQn3RDJUCrhwtOx0u']), false);
});
