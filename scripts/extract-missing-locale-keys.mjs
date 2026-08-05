import fs from 'fs';
import path from 'path';

const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('src/locales/ar.json', 'utf8'));

const keyDefaults = new Map(); // key -> { en?, ar? }

function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (name !== 'node_modules' && name !== 'locales') walk(full);
        } else if (/\.(jsx?|tsx?)$/.test(name)) {
            const content = fs.readFileSync(full, 'utf8');
            const re = /\bt\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"])?/g;
            let m;
            while ((m = re.exec(content))) {
                const key = m[1];
                const def = m[2];
                if (!keyDefaults.has(key)) keyDefaults.set(key, {});
                if (def) {
                    const hasArabic = /[\u0600-\u06FF]/.test(def);
                    const slot = hasArabic ? 'ar' : 'en';
                    if (!keyDefaults.get(key)[slot]) keyDefaults.get(key)[slot] = def;
                }
            }
        }
    }
}

walk('src');

const missing = [...keyDefaults.keys()].filter((k) => en[k] === undefined || ar[k] === undefined).sort();

const additionsEn = {};
const additionsAr = {};

for (const key of missing) {
    const d = keyDefaults.get(key) || {};
    if (en[key] === undefined) {
        additionsEn[key] = d.en || d.ar || humanizeKey(key);
    }
    if (ar[key] === undefined) {
        additionsAr[key] = d.ar || d.en || humanizeKey(key);
    }
}

function humanizeKey(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

fs.writeFileSync('scripts/_missing-locale-en.json', JSON.stringify(additionsEn, null, 2));
fs.writeFileSync('scripts/_missing-locale-ar.json', JSON.stringify(additionsAr, null, 2));
console.log('missing keys:', missing.length);
console.log('en additions:', Object.keys(additionsEn).length);
console.log('ar additions:', Object.keys(additionsAr).length);
