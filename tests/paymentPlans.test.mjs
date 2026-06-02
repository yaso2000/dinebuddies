import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    getCheckoutItem,
    getCheckoutItemByPriceId,
    getSubscriptionPlanByPriceId,
} = require('../functions/paymentPlans.js');

const elite = getCheckoutItem('elite');
assert.equal(elite.id, 'p5');
assert.equal(elite.mode, 'subscription');
assert.equal(elite.tier, 'elite');
assert.equal(elite.priceId, 'price_1T4DlqKpQn3RDJUC6vrueW0n');

const pro = getCheckoutItemByPriceId('price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(pro.id, 'p2');
assert.equal(pro.tier, 'pro');
assert.equal(pro.weeklyPrivateQuota, 2);

const premium = getSubscriptionPlanByPriceId('price_1T4DrkKpQn3RDJUC7cPercNu');
assert.equal(premium.id, 'p3');
assert.equal(premium.tier, 'vip');
assert.equal(premium.weeklyPrivateQuota, -1);

const privatePack = getCheckoutItem('c1');
assert.equal(privatePack.mode, 'payment');
assert.equal(privatePack.grant.purchasedPrivateCredits, 1);

const offerPack = getCheckoutItem('o1');
assert.equal(offerPack.mode, 'payment');
assert.equal(offerPack.grant.offerCredits, 1);

assert.equal(getCheckoutItem('not-a-real-plan'), null);
assert.equal(getCheckoutItemByPriceId('price_attacker_controlled'), null);

console.log('paymentPlans security assertions passed');
