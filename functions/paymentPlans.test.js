const assert = require('assert');
const {
    getCheckoutPlan,
    findCheckoutPlanByPriceId,
    getAllCheckoutPlans,
} = require('./paymentPlans');

assert.strictEqual(getCheckoutPlan('p2').mode, 'subscription');
assert.strictEqual(getCheckoutPlan('p2').tier, 'pro');
assert.strictEqual(getCheckoutPlan('vip').id, 'p3');
assert.strictEqual(getCheckoutPlan('elite').id, 'p5');

const privatePack = getCheckoutPlan('c3');
assert.strictEqual(privatePack.mode, 'payment');
assert.strictEqual(privatePack.creditsField, 'purchasedPrivateCredits');
assert.strictEqual(privatePack.credits, 5);

const offerPack = getCheckoutPlan('o1');
assert.strictEqual(offerPack.mode, 'payment');
assert.strictEqual(offerPack.creditsField, 'offerCredits');
assert.strictEqual(offerPack.credits, 1);

for (const plan of getAllCheckoutPlans()) {
    assert.ok(plan.priceId, `${plan.id} has a Stripe price`);
    assert.strictEqual(findCheckoutPlanByPriceId(plan.priceId).id, plan.id);
}

assert.strictEqual(getCheckoutPlan('not-real'), null);
assert.strictEqual(findCheckoutPlanByPriceId('price_not_real'), null);
