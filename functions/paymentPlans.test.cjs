const assert = require('assert');
const {
    getQuotaForPlan,
    getTierForPlan,
    resolveCheckoutProduct,
} = require('./paymentPlans');

const pro = resolveCheckoutProduct({
    planId: 'p2',
    priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
});
assert.strictEqual(pro.canonicalPlanId, 'pro');
assert.strictEqual(pro.mode, 'subscription');
assert.strictEqual(getTierForPlan('p2'), 'pro');
assert.strictEqual(getQuotaForPlan('p2'), 2);

const elite = resolveCheckoutProduct({
    planId: 'p5',
    priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
});
assert.strictEqual(elite.canonicalPlanId, 'elite');
assert.strictEqual(elite.mode, 'subscription');
assert.strictEqual(getTierForPlan('p5'), 'elite');
assert.strictEqual(getQuotaForPlan('p5'), 0);

const premium = resolveCheckoutProduct({
    planId: 'p3',
    priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
});
assert.strictEqual(premium.canonicalPlanId, 'vip');
assert.strictEqual(getTierForPlan('p3'), 'vip');
assert.strictEqual(getQuotaForPlan('p3'), -1);

const offerSlot = resolveCheckoutProduct({
    planId: 'o1',
    priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
});
assert.strictEqual(offerSlot.mode, 'payment');
assert.strictEqual(offerSlot.purchaseType, 'offer_slot');

const tampered = resolveCheckoutProduct({
    planId: 'elite',
    priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
});
assert.strictEqual(tampered, null);

console.log('paymentPlans tests passed');
