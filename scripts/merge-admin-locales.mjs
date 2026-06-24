import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const bundle = JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-admin.json'), 'utf8'));

function merge(file, additions) {
    const p = path.join(root, 'src/locales', file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    let added = 0;
    let updated = 0;
    for (const [key, value] of Object.entries(additions)) {
        if (data[key] === undefined) {
            data[key] = value;
            added += 1;
        } else if (data[key] !== value) {
            data[key] = value;
            updated += 1;
        }
    }
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    fs.writeFileSync(p, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    return { added, updated, total: Object.keys(sorted).length };
}

console.log('en', merge('en.json', bundle.en));
console.log('ar', merge('ar.json', bundle.ar));
