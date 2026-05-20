import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/ar.json'), 'utf8'));

const keyRe = /\bt\s*\(\s*['"]([^'"]+)['"]/g;
const files = [];

function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(jsx?|tsx?)$/.test(ent.name)) files.push(p);
    }
}
walk(srcDir);

const usedKeys = new Map();
for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = keyRe.exec(text))) {
        if (!usedKeys.has(m[1])) usedKeys.set(m[1], file);
    }
}

const missingInAr = [];
const missingInEn = [];
const sameAsEnUsed = [];
for (const [key, file] of usedKeys) {
    if (!en[key]) missingInEn.push({ key, file });
    if (!ar[key]) missingInAr.push({ key, file });
    else if (ar[key] === en[key]) sameAsEnUsed.push(key);
}

const out = { used: usedKeys.size, missingInAr, missingInEn, sameAsEnUsed };
fs.writeFileSync(path.join(root, 'i18n-scan.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ used: usedKeys.size, missingInAr: missingInAr.length, missingInEn: missingInEn.length, sameAsEnUsed: sameAsEnUsed.length }));
