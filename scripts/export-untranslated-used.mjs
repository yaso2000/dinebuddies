#!/usr/bin/env node
/** List keys used in app where locale value === English (needs translation). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));

const keys = new Set();
function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (name !== 'node_modules' && name !== 'locales') walk(full);
        } else if (/\.(jsx?|tsx?)$/.test(name)) {
            const content = fs.readFileSync(full, 'utf8');
            const re = /\bt\(\s*['"]([^'"]+)['"]/g;
            let m;
            while ((m = re.exec(content))) keys.add(m[1]);
        }
    }
}
walk(path.join(ROOT, 'src'));

const used = [...keys].filter((k) => typeof en[k] === 'string').sort();

const lang = process.argv[2] || 'ar';
const loc = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales', `${lang}.json`), 'utf8'));
const untranslated = used.filter((k) => loc[k] === en[k]);

const out = {};
for (const k of untranslated) out[k] = en[k];

const outPath = path.join(__dirname, `_untranslated-used-${lang}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(lang, 'untranslated used:', untranslated.length, '->', path.basename(outPath));
