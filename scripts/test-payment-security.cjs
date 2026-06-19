const assert = require('node:assert/strict');
const { PAYMENT_PLANS, getPaymentPlan, getPaymentPlanByPrice } = require('../functions/paymentPlans');

const plans = Object.values(PAYMENT_PLANS);
assert.ok(plans.length >= 9, 'expected subscription and one-time plans');

const priceIds = plans.map((plan) => plan.priceId);
assert.equal(new Set(priceIds).size, priceIds.length, 'price IDs must map to exactly one canonical plan');

assert.deepEqual(
    {
        tier: getPaymentPlan('p2').tier,
        quota: getPaymentPlan('p2').weeklyPrivateQuota,
        mode: getPaymentPlan('p2').mode,
    },
    { tier: 'pro', quota: 2, mode: 'subscription' }
);

assert.deepEqual(
    {
        tier: getPaymentPlan('p3').tier,
        quota: getPaymentPlan('p3').weeklyPrivateQuota,
        mode: getPaymentPlan('p3').mode,
    },
    { tier: 'vip', quota: -1, mode: 'subscription' }
);

assert.equal(getPaymentPlan('c1').mode, 'payment');
assert.equal(getPaymentPlan('c1').packType, 'private');
assert.equal(getPaymentPlanByPrice(getPaymentPlan('c1').priceId).planId, 'c1');

assert.equal(getPaymentPlan('o1').mode, 'payment');
assert.equal(getPaymentPlan('o1').packType, 'offer');
assert.equal(getPaymentPlanByPrice(getPaymentPlan('o1').priceId).planId, 'o1');

assert.equal(getPaymentPlan('not-a-plan'), null);
assert.equal(getPaymentPlanByPrice('price_attacker_controlled'), null);

console.log('payment security catalog assertions passed');
