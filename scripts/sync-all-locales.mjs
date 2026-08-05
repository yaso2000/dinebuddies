#!/usr/bin/env node
/**
 * Sync all locale files: fill gaps from en + locale-gap-i18n.json + en/ar-77 batches.
 * Usage: node scripts/sync-all-locales.mjs
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

/** Merge en.json with canonical English for the 77-code-audit keys. */
for (const [key, value] of Object.entries(gapEn77)) {
    en[key] = value;
}

const LOCALE_FILES = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

/** @param {string} langCode e.g. de from de.json */
function langFromFile(file) {
    return file.replace(/\.json$/, '');
}

function mergeNested(existing, incoming, enVal) {
    if (Array.isArray(enVal)) {
        return incoming ?? existing ?? enVal;
    }
    if (typeof enVal === 'object' && enVal !== null) {
        const base =
            existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
        for (const [k, v] of Object.entries(enVal)) {
            base[k] = mergeNested(base[k], incoming?.[k], v);
        }
        return base;
    }
    if (incoming !== undefined && incoming !== null) return incoming;
    if (existing !== undefined && existing !== null) return existing;
    return enVal;
}

function syncLocale(file) {
    const lang = langFromFile(file);
    const filePath = path.join(LOCALES_DIR, file);
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const gapMap = gapI18n[lang] || {};
    const result = {};

    let added = 0;
    let updated = 0;

    for (const key of Object.keys(en).sort()) {
        const enVal = en[key];
        let nextVal = existing[key];

        if (lang === 'en') {
            nextVal = enVal;
        } else if (lang === 'ar') {
            if (gapAr77[key] !== undefined) nextVal = gapAr77[key];
            else if (gapMap[key] !== undefined) nextVal = gapMap[key];
            else if (nextVal === undefined) nextVal = enVal;
        } else {
            if (gapMap[key] !== undefined) {
                nextVal = gapMap[key];
            } else if (typeof enVal === 'object' && enVal !== null) {
                nextVal = mergeNested(existing[key], existing[key], enVal);
            } else if (nextVal === undefined) {
                nextVal = enVal;
                added += 1;
            } else if (nextVal === enVal && gapMap[key] === undefined) {
                // keep existing English fallback if no translation batch
            }
        }

        if (existing[key] === undefined && nextVal !== undefined) added += 1;
        else if (existing[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(nextVal)) {
            updated += 1;
        }

        result[key] = nextVal ?? enVal;
    }

    fs.writeFileSync(filePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    const sameAsEn =
        lang === 'en'
            ? 0
            : Object.keys(en).filter((k) => typeof en[k] === 'string' && result[k] === en[k]).length;

    return { lang, keys: Object.keys(result).length, added, updated, sameAsEn };
}

// Write updated en.json first (77 keys)
fs.writeFileSync(
    path.join(LOCALES_DIR, 'en.json'),
    `${JSON.stringify(Object.fromEntries(Object.keys(en).sort().map((k) => [k, en[k]])), null, 2)}\n`,
    'utf8'
);

const reports = LOCALE_FILES.map(syncLocale);
console.log(JSON.stringify(reports, null, 2));
