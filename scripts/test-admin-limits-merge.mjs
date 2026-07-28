/**
 * Regression: adminUpdateBusinessLimits must use dotted-path updates, not replace businessInfo.
 * Static source check (no Firebase required).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexJs = readFileSync(join(root, 'functions/index.js'), 'utf8');

const block = indexJs.slice(
    indexJs.indexOf('exports.adminUpdateBusinessLimits'),
    indexJs.indexOf('exports.consumeOfferCredit')
);

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
}

assert(block.includes("'businessInfo.customLimits'"), 'must update businessInfo.customLimits via dotted path');
assert(block.includes("'businessInfo.customLimitsExpiry'"), 'must update businessInfo.customLimitsExpiry via dotted path');
assert(block.includes("'businessInfo.adminNotes'"), 'must update businessInfo.adminNotes via dotted path');
assert(block.includes("'businessInfo.lastAdminUpdate'"), 'must update businessInfo.lastAdminUpdate via dotted path');
assert(block.includes('.update({'), 'must use update(), not set()+merge that replaces nested maps');
assert(!/businessInfo:\s*\{/.test(block), 'must not assign a fresh businessInfo object (wipes nested fields)');

console.log('test-admin-limits-merge: all assertions passed');
