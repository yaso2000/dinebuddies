import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { validateProxyUrl } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const { resolveCheckoutPlan, resolvePlanByPriceId } = require('../functions/paymentPlans.js');

const pro = resolveCheckoutPlan('p2', 'price_attacker_supplied');
assert.equal(pro.id, 'p2');
assert.equal(pro.priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(pro.tier, 'pro');

const premium = resolveCheckoutPlan('p3', null);
assert.equal(premium.tier, 'vip');
assert.equal(premium.weeklyPrivateQuota, 10);

const tampered = resolveCheckoutPlan('p5', 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(tampered.id, 'p5');
assert.equal(tampered.priceId, 'price_1T4DlqKpQn3RDJUC6vrueW0n');

const byPrice = resolvePlanByPriceId('price_1T5mIGKpQn3RDJUCMzhlyN6a');
assert.equal(byPrice.id, 'o1');
assert.equal(byPrice.kind, 'offer_pack');
assert.equal(byPrice.offerCredits, 1);

assert.equal(resolveCheckoutPlan('not-a-plan', 'not-a-price'), null);

await assert.rejects(() => validateProxyUrl('file:///etc/passwd'), /Only http/);
await assert.rejects(() => validateProxyUrl('http://localhost/image.png'), /Blocked/);
await assert.rejects(() => validateProxyUrl('http://127.0.0.1/image.png'), /Blocked/);
await assert.rejects(() => validateProxyUrl('http://169.254.169.254/latest/meta-data'), /Blocked/);
await assert.rejects(() => validateProxyUrl('http://metadata.google.internal/computeMetadata/v1'), /Blocked/);

console.log('payment/proxy security assertions passed');
