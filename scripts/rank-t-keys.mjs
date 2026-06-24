#!/usr/bin/env node
/** Rank t() keys by usage frequency in src. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const counts = new Map();

function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (name !== 'node_modules' && name !== 'locales') walk(full);
        } else if (/\.(jsx?|tsx?)$/.test(name)) {
            const content = fs.readFileSync(full, 'utf8');
            const re = /\bt\(\s*['"]([^'"]+)['"]/g;
            let m;
            while ((m = re.exec(content))) {
                counts.set(m[1], (counts.get(m[1]) || 0) + 1);
            }
        }
    }
}
walk(path.join(ROOT, 'src'));

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));
const hi = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/hi.json'), 'utf8'));

const top = sorted.slice(0, 400).map(([k, n]) => ({
    key: k,
    uses: n,
    en: typeof en[k] === 'string' ? en[k] : '[object]',
    hiUntranslated: typeof en[k] === 'string' && hi[k] === en[k],
}));

fs.writeFileSync(path.join(__dirname, '_top-t-keys.json'), JSON.stringify(top, null, 2));
const untranslatedTop = top.filter((x) => x.hiUntranslated);
console.log('top 400 keys, untranslated in hi:', untranslatedTop.length);
