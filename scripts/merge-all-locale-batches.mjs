#!/usr/bin/env node
/**
 * Merge locale batch files + gap translations into src/locales/*.json
 * Usage: node scripts/merge-all-locale-batches.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src/locales');

const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
const gapI18n = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-gap-i18n.json'), 'utf8'));
const gapEn77 = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-gap-en-77.json'), 'utf8'));
const gapAr77 = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-gap-ar-77.json'), 'utf8'));

for (const [k, v] of Object.entries(gapEn77)) en[k] = v;

function loadBatches(prefix) {
    const out = {};
    if (!fs.existsSync(__dirname)) return out;
    for (const name of fs.readdirSync(__dirname)) {
        if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
        if (name.includes('-auto.json')) continue;
        if (name === 'locale-gap-i18n.json') continue;
        Object.assign(out, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    }
    return out;
}

function deepMerge(existing, incoming) {
    if (incoming === undefined || incoming === null) return existing;
    if (Array.isArray(incoming)) return incoming;
    if (typeof incoming === 'object' && typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
        const out = { ...existing };
        for (const [k, v] of Object.entries(incoming)) {
            out[k] = deepMerge(existing[k], v);
        }
        return out;
    }
    return incoming;
}

function mergeLocaleFile(file) {
    const lang = file.replace('.json', '');
    const filePath = path.join(LOCALES_DIR, file);
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const batches = loadBatches(`locale-${lang}-`);
    const gapMap = gapI18n[lang] || {};
    const autoPath = path.join(__dirname, `locale-${lang}-auto.json`);
    const auto = fs.existsSync(autoPath) ? JSON.parse(fs.readFileSync(autoPath, 'utf8')) : {};

    const result = {};
    for (const key of Object.keys(en).sort()) {
        let val = data[key];

        if (lang === 'en') {
            val = en[key];
        } else {
            if (lang === 'ar' && gapAr77[key] !== undefined) val = gapAr77[key];
            else if (batches[key] !== undefined) val = deepMerge(val, batches[key]);
            else if (auto[key] !== undefined) val = auto[key];
            else if (gapMap[key] !== undefined) val = gapMap[key];
            else if (val === undefined) val = en[key];
        }

        if (typeof en[key] === 'object' && en[key] !== null && !Array.isArray(en[key])) {
            val = deepMerge(en[key], val);
        }

        result[key] = val ?? en[key];
    }

    fs.writeFileSync(filePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    return lang;
}

fs.writeFileSync(
    path.join(LOCALES_DIR, 'en.json'),
    `${JSON.stringify(Object.fromEntries(Object.keys(en).sort().map((k) => [k, en[k]])), null, 2)}\n`,
    'utf8'
);

const langs = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).map(mergeLocaleFile);
console.log('Merged batches for:', langs.join(', '));
