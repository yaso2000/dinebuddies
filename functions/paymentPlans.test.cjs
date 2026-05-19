const assert = require('assert');
const {
    getPaymentPlan,
    getPaymentPlanByPriceId,
    listPaymentPlans,
    normalizePaymentPlanId,
} = require('./paymentPlans');

assert.strictEqual(normalizePaymentPlanId('elite'), 'p5');
assert.strictEqual(normalizePaymentPlanId('professional'), 'p4');
assert.strictEqual(normalizePaymentPlanId('vip'), 'p3');

const elite = getPaymentPlan('elite');
assert.strictEqual(elite.id, 'p5');
assert.strictEqual(elite.mode, 'subscription');
assert.strictEqual(elite.type, 'subscription');
assert.strictEqual(elite.tier, 'elite');
assert.ok(elite.priceId.startsWith('price_'));

const premium = getPaymentPlan('p3');
assert.strictEqual(premium.tier, 'vip');
assert.strictEqual(premium.weeklyPrivateQuota, 10);

const privatePack = getPaymentPlan('c3');
assert.strictEqual(privatePack.mode, 'payment');
assert.strictEqual(privatePack.type, 'private_credits');
assert.strictEqual(privatePack.purchasedPrivateCredits, 5);

const offerPack = getPaymentPlan('o1');
assert.strictEqual(offerPack.mode, 'payment');
assert.strictEqual(offerPack.type, 'offer_credits');
assert.strictEqual(offerPack.offerCredits, 1);

assert.strictEqual(getPaymentPlan('does-not-exist'), null);
assert.strictEqual(getPaymentPlanByPriceId(elite.priceId).id, 'p5');

const seen = new Set();
for (const plan of listPaymentPlans()) {
    assert.ok(plan.priceId, `missing priceId for ${plan.id}`);
    assert.ok(!seen.has(plan.priceId), `duplicate priceId ${plan.priceId}`);
    seen.add(plan.priceId);
}

console.log('paymentPlans catalog assertions passed');
