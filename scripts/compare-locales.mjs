import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/ar.json'), 'utf8'));

const enKeys = Object.keys(en).sort();
const arKeys = new Set(Object.keys(ar));

const missingInAr = enKeys.filter((k) => !arKeys.has(k));
const sameAsEn = enKeys.filter(
    (k) => arKeys.has(k) && ar[k] === en[k] && typeof en[k] === 'string'
);

function looksEnglish(text) {
    if (typeof text !== 'string' || !text.trim()) return false;
    const latin = (text.match(/[a-zA-Z]/g) || []).length;
    const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabic > 2) return false;
    return latin > 8;
}

const englishLikeInAr = enKeys.filter((k) => arKeys.has(k) && looksEnglish(ar[k]) && ar[k] !== en[k]);

const report = {
    counts: { en: enKeys.length, ar: arKeys.size },
    missingInAr,
    sameAsEn,
    englishLikeInAr: englishLikeInAr.map((k) => ({ key: k, en: en[k], ar: ar[k] })),
};
const outPath = path.join(root, 'missing-ar-keys.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(
    JSON.stringify({
        ...report.counts,
        missing: missingInAr.length,
        sameAsEn: sameAsEn.length,
        englishLike: englishLikeInAr.length,
    })
);
