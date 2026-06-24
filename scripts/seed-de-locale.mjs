/**
 * Seed de.json from en.json — preserves existing German translations.
 * Usage: node scripts/seed-de-locale.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dePath = path.join(root, 'src/locales/de.json');

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
let deExisting = {};
if (fs.existsSync(dePath)) {
    deExisting = JSON.parse(fs.readFileSync(dePath, 'utf8'));
}

function mergePreserveTranslated(existing, enVal) {
    if (Array.isArray(enVal)) {
        if (Array.isArray(existing) && JSON.stringify(existing) !== JSON.stringify(enVal)) return existing;
        return enVal;
    }
    if (typeof enVal === 'object' && enVal !== null) {
        const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
        for (const [k, v] of Object.entries(enVal)) {
            base[k] = mergePreserveTranslated(base[k], v);
        }
        return base;
    }
    if (typeof enVal !== 'string') return enVal;
    if (existing !== undefined && existing !== enVal) return existing;
    return enVal;
}

const result = {};
for (const key of Object.keys(en).sort()) {
    result[key] = mergePreserveTranslated(deExisting[key], en[key]);
}

fs.writeFileSync(dePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

const translated = Object.keys(en).filter(
    (k) => typeof en[k] === 'string' && result[k] !== en[k],
).length;
console.log(JSON.stringify({ enKeys: Object.keys(en).length, deKeys: Object.keys(result).length, translated }));
