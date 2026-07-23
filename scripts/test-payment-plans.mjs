import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
    CHECKOUT_PLANS,
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    normalizePlanId,
} = require('../functions/paymentPlans.js');

assert.equal(normalizePlanId('elite'), 'p5');
assert.equal(normalizePlanId('vip'), 'p3');

const pro = getCheckoutPlan('p2');
assert.equal(pro.priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(pro.mode, 'subscription');
assert.equal(pro.tier, 'pro');

const vip = getCheckoutPlan('p3');
assert.equal(vip.tier, 'vip');
assert.equal(vip.weeklyPrivateQuota, -1);

const eliteAlias = getCheckoutPlan('elite');
assert.equal(eliteAlias.id, 'p5');
assert.equal(eliteAlias.tier, 'elite');

const privatePack = getCheckoutPlan('c3');
assert.equal(privatePack.mode, 'payment');
assert.equal(privatePack.kind, 'private_pack');
assert.equal(privatePack.grantField, 'purchasedPrivateCredits');
assert.equal(privatePack.credits, 5);

const offerPack = getCheckoutPlan('o1');
assert.equal(offerPack.mode, 'payment');
assert.equal(offerPack.kind, 'offer_pack');
assert.equal(offerPack.grantField, 'offerCredits');

const prices = Object.values(CHECKOUT_PLANS).map((plan) => plan.priceId);
assert.equal(new Set(prices).size, prices.length, 'checkout prices must be unique');
for (const plan of Object.values(CHECKOUT_PLANS)) {
    assert.equal(getCheckoutPlanByPriceId(plan.priceId), plan);
}

assert.equal(getCheckoutPlanByPriceId('price_not_allowed'), null);
assert.equal(getCheckoutPlan('unknown'), null);
