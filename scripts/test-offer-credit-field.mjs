/**
 * Regression: Stripe offer-slot webhook and consume/publish must share one credit field.
 * Static source checks (no Firebase required).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webhook = readFileSync(join(root, 'functions/webhook.js'), 'utf8');
const consume = readFileSync(join(root, 'functions/index.js'), 'utf8');
const premium = readFileSync(join(root, 'src/services/premiumOfferService.js'), 'utf8');
const offerSvc = readFileSync(join(root, 'src/services/offerService.js'), 'utf8');

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
}

// Webhook for plan o1 must credit offerCredits (not only legacy offerSlotCredits)
const offerSlotBlock = webhook.slice(
    webhook.indexOf("planId === 'o1'"),
    webhook.indexOf('} else {', webhook.indexOf("planId === 'o1'"))
);
assert(offerSlotBlock.includes('offerCredits'), 'webhook o1 path must write offerCredits');
assert(
    !offerSlotBlock.includes('offerSlotCredits:'),
    'webhook o1 path must not write offerSlotCredits as the primary grant'
);

// consumeOfferCredit must understand both fields for legacy balances
const consumeBlock = consume.slice(
    consume.indexOf('exports.consumeOfferCredit'),
    consume.indexOf('exports.adminMigratePartnerRoles')
);
assert(consumeBlock.includes('offerCredits'), 'consumeOfferCredit must use offerCredits');
assert(
    consumeBlock.includes('offerSlotCredits'),
    'consumeOfferCredit must drain legacy offerSlotCredits'
);

assert(
    premium.includes('offerCredits') && premium.includes('offerSlotCredits'),
    'premiumOfferService must accept both credit fields'
);
assert(
    offerSvc.includes('offerSlotCredits'),
    'offerService must accept legacy offerSlotCredits'
);

console.log('test-offer-credit-field: all assertions passed');
