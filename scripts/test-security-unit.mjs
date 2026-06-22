import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { isBlockedIp, validateProxyUrl } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const { getCheckoutPlan, getCheckoutPlanByPrice, listCheckoutPlans } = require('../functions/paymentPlans.js');

function assertPaymentCatalog() {
    const cheapPrivatePack = getCheckoutPlan('c1');
    const elitePlan = getCheckoutPlan('elite');

    assert.equal(getCheckoutPlan('premium'), null, 'keyword-only premium metadata must not resolve to a plan');
    assert.equal(getCheckoutPlan('pro'), null, 'keyword-only pro metadata must not resolve to a plan');
    assert.equal(cheapPrivatePack.kind, 'private_pack');
    assert.equal(elitePlan.kind, 'subscription');
    assert.notEqual(cheapPrivatePack.priceId, elitePlan.priceId, 'cheap pack price must not grant elite');
    assert.equal(getCheckoutPlanByPrice(cheapPrivatePack.priceId).kind, 'private_pack');
    assert.equal(getCheckoutPlanByPrice(cheapPrivatePack.priceId).tier, undefined);

    const plans = listCheckoutPlans();
    assert(plans.every((plan) => plan.priceId && plan.mode && plan.kind), 'all plans need price/mode/kind');
    assert(plans.some((plan) => plan.id === 'p5' && plan.tier === 'elite'), 'elite UI plan is cataloged');
    assert(plans.some((plan) => plan.id === 'elite' && plan.tier === 'elite'), 'legacy business caller is cataloged');
}

async function assertProxyValidation() {
    assert.equal(isBlockedIp('127.0.0.1'), true);
    assert.equal(isBlockedIp('10.0.0.4'), true);
    assert.equal(isBlockedIp('172.16.5.10'), true);
    assert.equal(isBlockedIp('192.168.1.5'), true);
    assert.equal(isBlockedIp('169.254.169.254'), true);
    assert.equal(isBlockedIp('8.8.8.8'), false);

    await assert.rejects(() => validateProxyUrl('file:///etc/passwd'), /Only http and https/);
    await assert.rejects(() => validateProxyUrl('http://localhost/admin'), /Blocked proxy hostname|Blocked proxy address/);
    await assert.rejects(() => validateProxyUrl('http://127.0.0.1/admin'), /Blocked proxy address/);
    await assert.rejects(() => validateProxyUrl('http://169.254.169.254/latest/meta-data/'), /Blocked proxy address/);
    await assert.rejects(() => validateProxyUrl('https://user:pass@example.com/image.png'), /embedded credentials/);
}

await assertProxyValidation();
assertPaymentCatalog();

console.log('Security unit assertions passed');
