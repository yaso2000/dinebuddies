import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import proxyHandler from '../api/proxy.js';

const require = createRequire(import.meta.url);
const {
    getPaymentPlan,
    findPaymentPlanByPriceId,
    activeSubscriptionStatus,
} = require('../functions/paymentPlans.js');

function createMockResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        ended: false,
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            this.ended = true;
            return this;
        },
        send(payload) {
            this.body = payload;
            this.ended = true;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
    };
}

async function runProxy(req) {
    const res = createMockResponse();
    await proxyHandler(req, res);
    return res;
}

const pro = getPaymentPlan('p2');
assert.equal(pro.tier, 'pro');
assert.equal(pro.mode, 'subscription');
assert.equal(pro.priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
assert.equal(findPaymentPlanByPriceId(pro.priceId).planId, 'p2');

const invitePack = getPaymentPlan('c2');
assert.equal(invitePack.mode, 'payment');
assert.equal(invitePack.fulfillment, 'private_invites');
assert.equal(invitePack.credits, 3);

const offerPack = getPaymentPlan('o1');
assert.equal(offerPack.fulfillment, 'offer_credits');
assert.equal(offerPack.credits, 1);
assert.equal(getPaymentPlan('not-a-plan'), null);
assert.equal(findPaymentPlanByPriceId('price_attacker'), null);
assert.equal(activeSubscriptionStatus('active'), true);
assert.equal(activeSubscriptionStatus('trialing'), true);
assert.equal(activeSubscriptionStatus('past_due'), false);

let res = await runProxy({ method: 'GET', query: { url: 'file:///etc/passwd' } });
assert.equal(res.statusCode, 400);
assert.match(res.body.error, /http and https/i);

res = await runProxy({ method: 'GET', query: { url: 'http://127.0.0.1/latest/meta-data/' } });
assert.equal(res.statusCode, 400);
assert.match(res.body.error, /blocked/i);

res = await runProxy({ method: 'GET', query: { url: 'http://169.254.169.254/latest/meta-data/' } });
assert.equal(res.statusCode, 400);
assert.match(res.body.error, /blocked/i);

res = await runProxy({ method: 'OPTIONS', query: {} });
assert.equal(res.statusCode, 204);

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
assert(!rules.includes("get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'"));
assert(rules.includes("'stripeCustomerId'"));
assert(rules.includes("'purchasedPrivateCredits'"));
assert(rules.includes("request.resource.data.status == 'draft'"));

console.log('critical security regression checks passed');
