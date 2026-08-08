#!/usr/bin/env node
/**
 * Translate remaining _untranslated-used-{lang}.json keys via Google Translate.
 * Skips URLs, phone placeholders, and brand-only keys.
 * Usage: node scripts/translate-untranslated-batch.mjs de [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lang = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

const GOOGLE_TL = {
    de: 'de', fr: 'fr', es: 'es', it: 'it', pt: 'pt', tr: 'tr', ar: 'ar', hi: 'hi', ur: 'ur',
};

if (!lang || !GOOGLE_TL[lang]) {
    console.error('Usage: node scripts/translate-untranslated-batch.mjs <lang> [--dry-run]');
    process.exit(1);
}

const sourcePath = path.join(__dirname, `_untranslated-used-${lang}.json`);
const outPath = path.join(__dirname, `locale-${lang}-used-supplement.json`);

if (!fs.existsSync(sourcePath)) {
    console.error('Missing', sourcePath, '- run export-untranslated-used.mjs first');
    process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

const SKIP_KEY = /^(app_version|affiliate_dash_paypal_label|feedback_phone_ph|delivery_link_url_placeholder)$/;
const SKIP_VALUE = /^(https?:\/\/|\+?\d[\d\s\-+()]+$|PayPal$|Instagram$|Facebook$|TikTok$|Twitter \/ X$|Google Maps$|Emoji$|Premium$|Dine Credits$|DineBuddies)/i;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function translate(text) {
    const q = encodeURIComponent(text.slice(0, 450));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${GOOGLE_TL[lang]}&dt=t&q=${q}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const data = await res.json();
            const translated = data?.[0]?.map((p) => p[0]).join('') || data?.[0]?.[0]?.[0];
            if (translated) return translated;
            throw new Error('empty response');
        }
        if (res.status >= 500) {
            await sleep(800 * (attempt + 1));
            continue;
        }
        throw new Error(`HTTP ${res.status}`);
    }
    throw new Error('HTTP 500 after retries');
}

const pending = Object.keys(source).filter((k) => {
    if (SKIP_KEY.test(k)) return false;
    if (SKIP_VALUE.test(String(source[k]).trim())) return false;
    if (existing[k] && existing[k] !== source[k]) return false;
    return true;
});

console.log(`${lang}: translating ${pending.length} keys${dryRun ? ' (dry-run)' : ''}...`);

let done = 0;
for (const key of pending) {
    const text = source[key];
    try {
        const translated = await translate(text);
        if (!dryRun) existing[key] = translated;
        done += 1;
        if (done % 20 === 0) console.log(`  ${done}/${pending.length}`);
    } catch (err) {
        console.warn(`  skip ${key}:`, err.message);
        if (!dryRun) existing[key] = text;
    }
    await sleep(120);
}

if (!dryRun) {
    fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
}
console.log(`Done. ${done} translated -> ${path.basename(outPath)}`);
