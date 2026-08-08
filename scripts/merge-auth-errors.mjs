import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function merge(file, additions) {
    const p = path.join(root, 'src/locales', file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(additions)) {
        if (data[k] === undefined) data[k] = v;
    }
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    fs.writeFileSync(p, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

merge('ar.json', JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-ar-auth-errors.json'), 'utf8')));
merge('en.json', JSON.parse(fs.readFileSync(path.join(__dirname, 'locale-en-auth-errors.json'), 'utf8')));
console.log('auth errors merged');
