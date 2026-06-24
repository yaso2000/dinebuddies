import fs from 'fs';
import path from 'path';

const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('src/locales/ar.json', 'utf8'));
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

walk('src');

const missingEn = [...keys].filter((k) => en[k] === undefined).sort();
const missingAr = [...keys].filter((k) => ar[k] === undefined).sort();

console.log('unique t keys:', keys.size);
console.log('missing en:', missingEn.length);
console.log('missing ar:', missingAr.length);
if (missingEn.length) console.log('missing en sample:', missingEn.slice(0, 60).join('\n'));
if (missingAr.length) console.log('missing ar sample:', missingAr.slice(0, 60).join('\n'));
