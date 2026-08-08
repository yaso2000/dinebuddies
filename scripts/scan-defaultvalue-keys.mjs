import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ar = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/ar.json'), 'utf8'));
const srcDir = path.join(root, 'src');
const files = [];
function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(jsx?|tsx?)$/.test(ent.name)) files.push(p);
    }
}
walk(srcDir);

const re = /\bt\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*defaultValue:\s*['"`]((?:\\.|[^'"`\\])*)['"`]/gs;
const missing = new Map();
for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(text))) {
        const key = m[1];
        if (!ar[key] && !missing.has(key)) {
            missing.set(key, m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'"));
        }
    }
}
const list = [...missing.entries()].map(([key, en]) => ({ key, en }));
fs.writeFileSync(path.join(root, 'defaultvalue-missing-ar.json'), JSON.stringify(list, null, 2));
console.log('defaultValue keys missing in ar:', list.length);
