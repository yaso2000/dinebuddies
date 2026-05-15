const assert = require('node:assert/strict');
const test = require('node:test');

const {
    findByPlanId,
    findByPriceId,
    isExpectedPriceForProduct,
    resolveCheckoutProduct,
} = require('./paymentPlans');

test('resolves client catalog ids to canonical subscription entitlements', () => {
    const pro = findByPlanId('p2');
    assert.equal(pro.planId, 'pro');
    assert.equal(pro.mode, 'subscription');
    assert.equal(pro.tier, 'pro');
    assert.equal(pro.weeklyQuota, 2);

    const elite = findByPlanId('p5');
    assert.equal(elite.planId, 'elite');
    assert.equal(elite.tier, 'elite');
});

test('resolves one-time add-on packs as payment-mode products', () => {
    const privatePack = findByPlanId('c3');
    assert.equal(privatePack.mode, 'payment');
    assert.equal(privatePack.type, 'private_invitation_credits');
    assert.equal(privatePack.privateCredits, 5);

    const offerSlot = findByPlanId('o1');
    assert.equal(offerSlot.mode, 'payment');
    assert.equal(offerSlot.type, 'offer_slot');
});

test('uses server configured prices for both checkout and webhook verification', () => {
    const previous = process.env.STRIPE_PRICE_USER_PRO;
    process.env.STRIPE_PRICE_USER_PRO = 'price_server_owned_pro';
    try {
        const product = resolveCheckoutProduct({ planId: 'p2', priceId: 'price_attacker_choice' });
        assert.equal(product.priceId, 'price_server_owned_pro');
        assert.equal(findByPriceId('price_server_owned_pro').planId, 'pro');
        assert.equal(isExpectedPriceForProduct(product, ['price_server_owned_pro']), true);
        assert.equal(isExpectedPriceForProduct(product, ['price_attacker_choice']), false);
    } finally {
        if (previous == null) {
            delete process.env.STRIPE_PRICE_USER_PRO;
        } else {
            process.env.STRIPE_PRICE_USER_PRO = previous;
        }
    }
});
