import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isPrivateAddress } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const { resolveCheckoutItem, getCheckoutItemByPriceId } = require('../functions/paymentPlans.js');

function read(path) {
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const rules = read('firestore.rules');
assert(!rules.includes("get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'"), 'rules must not trust users.role for admin');
assert(rules.includes('isAllowedOwnerUserUpdate'), 'rules must constrain owner user updates');
assert(rules.includes('purchasedPrivateCredits'), 'rules must protect private invitation credits');
assert(rules.includes('paidCredits'), 'rules must protect paid Dine Credits');
assert(rules.includes('isPrivateInvitationDraft'), 'rules must require private invitations to start as drafts');
assert(rules.includes('!publishesPrivateInvitation()'), 'rules must prevent direct private invitation publish');

const functionsIndex = read('functions/index.js');
const assertAdminContext = functionsIndex.slice(
    functionsIndex.indexOf('async function assertAdminContext'),
    functionsIndex.indexOf('function asTrimmedString')
);
assert(!assertAdminContext.includes('requesterDoc'), 'assertAdminContext must not read users/{uid}.role');
assert(!assertAdminContext.includes("requesterRole === 'admin'"), 'assertAdminContext must not trust Firestore admin role');
assert(functionsIndex.includes('targetIsConfiguredSuperOwner'), 'grantAdminRole must not copy requester superOwner to every target');

const stripeJs = read('functions/stripe.js');
const createCheckoutSession = stripeJs.slice(
    stripeJs.indexOf('exports.createCheckoutSession'),
    stripeJs.indexOf('/**\n * إنشاء Portal')
);
assert(createCheckoutSession.includes('resolveCheckoutItem'), 'checkout must resolve server-owned catalog item');
assert(!createCheckoutSession.includes('price: priceId'), 'checkout must not use client-supplied priceId');
assert(createCheckoutSession.includes('mode: checkoutItem.mode'), 'checkout must use catalog checkout mode');

const webhookJs = read('functions/webhook.js');
assert(webhookJs.includes('listLineItems'), 'webhook must inspect paid Stripe line items');
assert(webhookJs.includes('paidPriceId !== catalogItem.priceId'), 'webhook must reject catalog price mismatches');
assert(webhookJs.includes('purchasedPrivateCredits'), 'webhook must fulfill private invitation credit packs');
assert(webhookJs.includes('offerCredits'), 'webhook must fulfill offer credit packs into spendable offerCredits');

const authContext = read('src/context/AuthContext.jsx');
assert(!authContext.includes('purchasedPrivateCredits: grantedCredits'), 'client profile create must not mint private credits');
assert(!authContext.includes('reputation: 100'), 'client profile create must not mint reputation');

assert.equal(resolveCheckoutItem('p2').tier, 'pro');
assert.equal(resolveCheckoutItem('elite').id, 'p5');
assert.equal(resolveCheckoutItem('c1').mode, 'payment');
assert.equal(resolveCheckoutItem('o1').purchaseType, 'offer_credits');
assert.equal(getCheckoutItemByPriceId('price_1T4E1aKpQn3RDJUCMLLV7g4D').id, 'c2');

assert.equal(isPrivateAddress('127.0.0.1'), true);
assert.equal(isPrivateAddress('10.0.0.5'), true);
assert.equal(isPrivateAddress('169.254.169.254'), true);
assert.equal(isPrivateAddress('192.168.1.10'), true);
assert.equal(isPrivateAddress('8.8.8.8'), false);

console.log('security regression assertions passed');
