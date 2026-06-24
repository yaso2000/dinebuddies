import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    getCheckoutItemByPrice,
    resolveCheckoutItem,
} = require('../functions/paymentPlans');

const proPrice = 'price_1T4DptKpQn3RDJUCrhwtOx0u';
const elitePrice = 'price_1T4DlqKpQn3RDJUC6vrueW0n';
const offerPackPrice = 'price_1T5mIGKpQn3RDJUCMzhlyN6a';

assert.equal(getCheckoutItemByPrice(proPrice).id, 'p2');
assert.equal(getCheckoutItemByPrice(elitePrice).tier, 'elite');
assert.equal(getCheckoutItemByPrice(offerPackPrice).mode, 'payment');
assert.equal(getCheckoutItemByPrice(offerPackPrice).type, 'offer_pack');
assert.equal(getCheckoutItemByPrice(offerPackPrice).offerCredits, 1);

const forged = resolveCheckoutItem({ priceId: proPrice, planId: 'elite' });
assert.equal(forged.id, 'p2');
assert.equal(forged.tier, 'pro');

assert.equal(resolveCheckoutItem({ priceId: 'price_unknown', planId: 'elite' }), null);

console.log('payment catalog checks passed');
