#!/usr/bin/env node
/**
 * Auto-translate locale keys via Google Translate (free, rate-limited).
 * Usage: node scripts/translate-locale-mymemory.mjs hi [--limit 200] [--full]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const lang = process.argv[2];
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const useFull = process.argv.includes('--full');

if (!lang || !['hi', 'ur'].includes(lang)) {
    console.error('Usage: node scripts/translate-locale-mymemory.mjs <hi|ur> [--limit N] [--full]');
    process.exit(1);
}

const LANG_GOOGLE = { hi: 'hi', ur: 'ur' };
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));
const outPath = path.join(__dirname, `locale-${lang}-auto.json`);
const prevCount = fs.existsSync(outPath) ? Object.keys(JSON.parse(fs.readFileSync(outPath, 'utf8'))).length : 0;
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

let source;
if (useFull) {
    source = {};
    for (const [k, v] of Object.entries(en)) {
        if (typeof v === 'string') source[k] = v;
    }
} else {
    const sourcePath = path.join(__dirname, `_untranslated-used-${lang}.json`);
    if (!fs.existsSync(sourcePath)) {
        console.error('Missing', sourcePath, '- use --full or run export-untranslated-used.mjs');
        process.exit(1);
    }
    source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
}

const pending = Object.keys(source).filter((k) => {
    if (!existing[k]) return true;
    return existing[k] === source[k];
});
const batch = pending.slice(0, limit);

console.log(`${lang}: ${pending.length} pending, translating ${batch.length} (existing ${Object.keys(existing).length})...`);

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function translate(text) {
    const tl = LANG_GOOGLE[lang];
    const q = encodeURIComponent(text.slice(0, 450));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${q}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) {
            if (res.status >= 500) {
                await sleep(800 * (attempt + 1));
                continue;
            }
            throw new Error(`Google HTTP ${res.status}`);
        }
        const data = await res.json();
        const translated = data?.[0]?.map((p) => p[0]).join('') || data?.[0]?.[0]?.[0];
        if (!translated) throw new Error('Google empty');
        if (translated.trim() === text.trim()) throw new Error('Google returned source');
        return translated;
    }
    throw new Error('Google HTTP 500 after retries');
}

let done = 0;
for (const key of batch) {
    const text = source[key];
    try {
        existing[key] = await translate(text);
        done += 1;
        if (done % 25 === 0) {
            fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
            console.log(`  saved ${done}/${batch.length}`);
        }
    } catch (err) {
        console.warn(`  skip ${key}:`, err.message);
        existing[key] = text;
    }
    await sleep(150);
}

const finalCount = Object.keys(existing).length;
if (finalCount < prevCount) {
    console.error(`Refusing to shrink ${path.basename(outPath)}: ${prevCount} -> ${finalCount}`);
    process.exit(1);
}

fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
console.log(`Done. ${done} translated. Total in ${path.basename(outPath)}: ${finalCount}`);
