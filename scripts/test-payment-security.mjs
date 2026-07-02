import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    getSubscriptionPlanByPriceId,
} = require('../functions/paymentPlans.js');
const { priceIdToCreditPackage } = require('../functions/creditsCore.js');

const pro = getCheckoutPlan('p2');
assert.equal(pro.priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(pro.mode, 'subscription');
assert.equal(pro.fulfillment, 'subscription');
assert.equal(pro.tier, 'pro');

const proAlias = getCheckoutPlan('pro');
assert.equal(proAlias.id, 'p2');

const vip = getCheckoutPlan('p3');
assert.equal(vip.tier, 'vip');
assert.equal(vip.weeklyPrivateQuota, 10);

const privatePack = getCheckoutPlan('c5');
assert.equal(privatePack.mode, 'payment');
assert.equal(privatePack.fulfillment, 'private_pack');
assert.equal(privatePack.privateCredits, 20);

const offerPack = getCheckoutPlan('o1');
assert.equal(offerPack.mode, 'payment');
assert.equal(offerPack.fulfillment, 'offer_pack');
assert.equal(offerPack.offerCredits, 1);

assert.equal(getCheckoutPlan('unknown'), null);
assert.equal(getCheckoutPlanByPriceId(pro.priceId).id, 'p2');
assert.equal(getSubscriptionPlanByPriceId(pro.priceId).id, 'p2');
assert.equal(getSubscriptionPlanByPriceId(offerPack.priceId), null);

process.env.STRIPE_PRICE_USER_PRO = 'price_server_owned_override';
assert.equal(getCheckoutPlan('p2').priceId, 'price_server_owned_override');
assert.equal(getCheckoutPlanByPriceId('price_1T4DptKpQn3RDJUCrhwtOx0u'), null);

process.env.STRIPE_PRICE_CREDITS_200 = 'price_credits_200';
assert.deepEqual(priceIdToCreditPackage().price_credits_200, {
    packageId: 'credits_200',
    credits: 200,
});

console.log('Payment catalog security assertions passed.');
