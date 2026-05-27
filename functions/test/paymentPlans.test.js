const assert = require('assert');
const {
    getCheckoutProduct,
    getCheckoutProductByPriceId,
    getSubscriptionProduct,
} = require('../paymentPlans');

assert.strictEqual(getCheckoutProduct('p2').planId, 'pro');
assert.strictEqual(getCheckoutProduct('pro').id, 'p2');
assert.strictEqual(getCheckoutProduct('p3').subscriptionTier, 'vip');
assert.strictEqual(getCheckoutProduct('vip').weeklyPrivateQuota, -1);
assert.strictEqual(getCheckoutProduct('elite').priceId, 'price_1T4DlqKpQn3RDJUC6vrueW0n');
assert.strictEqual(getCheckoutProduct('o1').mode, 'payment');
assert.strictEqual(getCheckoutProduct('o1').offerCredits, 1);
assert.strictEqual(getCheckoutProduct('c5').purchasedPrivateCredits, 20);
assert.strictEqual(
    getCheckoutProductByPriceId('price_1T4DptKpQn3RDJUCrhwtOx0u').id,
    'p2'
);
assert.strictEqual(getSubscriptionProduct('o1'), null);

console.log('paymentPlans tests passed');
