const assert = require('assert');
const {
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    listCheckoutPlans,
} = require('./paymentPlans');

const pro = getCheckoutPlan('p2');
assert.strictEqual(pro.priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.strictEqual(pro.mode, 'subscription');
assert.strictEqual(pro.subscriptionTier, 'pro');

const premiumAlias = getCheckoutPlan('vip');
assert.strictEqual(premiumAlias.id, 'p3');
assert.strictEqual(premiumAlias.subscriptionTier, 'vip');

const businessAlias = getCheckoutPlan('elite');
assert.strictEqual(businessAlias.id, 'p5');
assert.strictEqual(businessAlias.mode, 'subscription');

const offerSlot = getCheckoutPlan('o1');
assert.strictEqual(offerSlot.mode, 'payment');
assert.strictEqual(offerSlot.purchaseType, 'offer_slot_pack');
assert.strictEqual(offerSlot.offerCredits, 1);

const paidPrivatePack = getCheckoutPlanByPriceId('price_1T4E1xKpQn3RDJUC6wYEr9I1');
assert.strictEqual(paidPrivatePack.id, 'c3');
assert.strictEqual(paidPrivatePack.privateCredits, 5);

assert.strictEqual(getCheckoutPlan('not-a-plan'), null);
assert.strictEqual(getCheckoutPlanByPriceId('price_unknown'), null);

const ids = listCheckoutPlans().map((plan) => plan.id);
assert.deepStrictEqual(new Set(ids).size, ids.length);

console.log('paymentPlans assertions passed');
