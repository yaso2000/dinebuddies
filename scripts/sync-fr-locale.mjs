/**
 * Offline French locale sync — merges manual batches into fr.json.
 * Missing keys fall back to English via i18next (fallbackLng: en).
 * Usage: node scripts/sync-fr-locale.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const frExisting = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/fr.json'), 'utf8'));

function loadManualBatches() {
    const out = {};
    for (const name of fs.readdirSync(__dirname)) {
        if (!name.startsWith('locale-fr-') || !name.endsWith('.json')) continue;
        Object.assign(out, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    }
    return out;
}

function mergeNested(existing, incoming, enVal) {
    if (Array.isArray(enVal)) {
        return incoming ?? existing ?? enVal;
    }
    if (typeof enVal === 'object' && enVal !== null) {
        const base = { ...(existing && typeof existing === 'object' ? existing : {}) };
        for (const [k, v] of Object.entries(enVal)) {
            base[k] = mergeNested(base[k], incoming?.[k], v);
        }
        return base;
    }
    return incoming ?? existing;
}

const manual = loadManualBatches();
const result = { ...frExisting };
let added = 0;
let updated = 0;

for (const key of Object.keys(en).sort()) {
    const enVal = en[key];
    const manualVal = manual[key];
    const existingVal = result[key];

    if (manualVal !== undefined) {
        if (existingVal !== manualVal) updated += 1;
        result[key] = manualVal;
        if (existingVal === undefined) added += 1;
        continue;
    }

    if (typeof enVal === 'object' && enVal !== null) {
        const merged = mergeNested(existingVal, existingVal, enVal);
        if (JSON.stringify(merged) !== JSON.stringify(existingVal)) {
            result[key] = merged;
            if (existingVal === undefined) added += 1;
            else updated += 1;
        }
        continue;
    }

    if (existingVal !== undefined && existingVal !== enVal) {
        continue;
    }
}

const sorted = Object.fromEntries(Object.keys(result).sort().map((k) => [k, result[k]]));
fs.writeFileSync(path.join(root, 'src/locales/fr.json'), `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

const frKeys = Object.keys(sorted).length;
const enKeys = Object.keys(en).length;
const missing = Object.keys(en).filter((k) => sorted[k] === undefined).length;
const sameAsEn = Object.keys(en).filter(
    (k) => typeof en[k] === 'string' && sorted[k] === en[k],
).length;

console.log(JSON.stringify({ frKeys, enKeys, added, updated, missing, sameAsEn }));
