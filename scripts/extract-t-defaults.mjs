import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const ar = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/ar.json'), 'utf8'));

const files = [];
function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(jsx?|tsx?)$/.test(ent.name)) files.push(p);
    }
}
walk(srcDir);

// t('key') or t('key', 'default') or t('key', "default") — also multiline default in some cases
const re = /\bt\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"`]([^'"`]*(?:\\.[^'"`]*)*)['"`])?/gs;

const entries = new Map();
for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(text))) {
        const key = m[1];
        let def = m[2];
        if (def) def = def.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (!ar[key]) {
            if (!entries.has(key) && def) entries.set(key, def);
            else if (!entries.has(key)) entries.set(key, null);
        }
    }
}

const list = [...entries.entries()].map(([key, en]) => ({ key, en }));
fs.writeFileSync(path.join(root, 'keys-to-translate.json'), JSON.stringify(list, null, 2));
console.log('keys needing ar:', list.length, 'with default:', list.filter((x) => x.en).length);
