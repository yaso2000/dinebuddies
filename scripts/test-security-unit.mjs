import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { validateProxyUrl } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const {
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    normalizePlanId,
} = require('../functions/paymentPlans.js');

assert.equal(normalizePlanId('elite'), 'p5');
assert.equal(getCheckoutPlan('p2').priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(getCheckoutPlan('p2').mode, 'subscription');
assert.equal(getCheckoutPlan('p2').tier, 'pro');
assert.equal(getCheckoutPlan('p3').tier, 'vip');
assert.equal(getCheckoutPlan('o1').mode, 'payment');
assert.equal(getCheckoutPlan('o1').fulfillment, 'offer_slot');
assert.equal(getCheckoutPlanByPriceId('price_1T4DlqKpQn3RDJUC6vrueW0n').id, 'p5');
assert.equal(getCheckoutPlanByPriceId('price_not_allowed'), null);

assert.equal((await validateProxyUrl('file:///etc/passwd')).ok, false);
assert.equal((await validateProxyUrl('http://localhost/image.png')).ok, false);
assert.equal((await validateProxyUrl('http://127.0.0.1/image.png')).ok, false);
assert.equal((await validateProxyUrl('http://169.254.169.254/latest/meta-data')).ok, false);
assert.equal((await validateProxyUrl('https://example.com/image.png')).ok, true);

console.log('security unit assertions passed');
