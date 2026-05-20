import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function mergeLocale(file, additions) {
    const p = path.join(root, 'src/locales', file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    let added = 0;
    let updated = 0;
    for (const [key, value] of Object.entries(additions)) {
        if (data[key] === undefined) {
            data[key] = value;
            added += 1;
        } else if (data[key] !== value && file === 'ar.json') {
            data[key] = value;
            updated += 1;
        }
    }
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    fs.writeFileSync(p, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    return { added, updated, total: Object.keys(sorted).length };
}

const arAdd = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-ar-additions.json'), 'utf8'));
const enAdd = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-en-additions.json'), 'utf8'));

console.log('ar', mergeLocale('ar.json', arAdd));
console.log('en', mergeLocale('en.json', enAdd));
