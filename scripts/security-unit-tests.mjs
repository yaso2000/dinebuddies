import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { isPrivateAddress, assertSafeUrl } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const {
    getCheckoutItemById,
    getCheckoutItemByPriceId,
    resolveCheckoutItem,
} = require('../functions/paymentPlans.js');

function testPaymentCatalog() {
    assert.equal(getCheckoutItemById('p2').tier, 'pro');
    assert.equal(getCheckoutItemById('pro').id, 'p2');
    assert.equal(getCheckoutItemById('p3').tier, 'vip');
    assert.equal(getCheckoutItemById('elite').id, 'p5');
    assert.equal(getCheckoutItemById('o1').purchaseType, 'offer_pack');
    assert.equal(getCheckoutItemByPriceId('price_1T4DptKpQn3RDJUCrhwtOx0u').id, 'p2');

    const spoofed = resolveCheckoutItem({
        planId: 'p5',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
    });
    assert.equal(spoofed.id, 'p5', 'planId resolution must force the server-owned p5 price');
}

async function testProxyGuards() {
    assert.equal(isPrivateAddress('127.0.0.1'), true);
    assert.equal(isPrivateAddress('10.0.0.7'), true);
    assert.equal(isPrivateAddress('172.16.0.1'), true);
    assert.equal(isPrivateAddress('192.168.1.1'), true);
    assert.equal(isPrivateAddress('169.254.169.254'), true);
    assert.equal(isPrivateAddress('8.8.8.8'), false);
    assert.equal(isPrivateAddress('::1'), true);
    assert.equal(isPrivateAddress('fc00::1'), true);

    await assert.rejects(() => assertSafeUrl('file:///etc/passwd'), /http/);
    await assert.rejects(() => assertSafeUrl('http://127.0.0.1/admin'), /Blocked/);
    await assert.rejects(() => assertSafeUrl('http://169.254.169.254/latest/meta-data'), /Blocked/);
    await assert.rejects(() => assertSafeUrl('http://localhost:8080'), /Blocked/);
}

testPaymentCatalog();
await testProxyGuards();

console.log('security-unit-tests: ok');
