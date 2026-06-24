#!/usr/bin/env node
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

const used = [...keys].filter((k) => en[k] !== undefined);
const report = {};

for (const file of fs.readdirSync(path.join(ROOT, 'src/locales')).filter((f) => f.endsWith('.json'))) {
    const lang = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales', file), 'utf8'));
    const untranslated = used.filter((k) => typeof en[k] === 'string' && data[k] === en[k]);
    report[lang] = {
        totalKeys: Object.keys(data).length,
        usedInApp: used.length,
        untranslatedUsed: untranslated.length,
    };
}

console.log(JSON.stringify(report, null, 2));
