/**
 * Replace Arabic t() fallbacks with English from en.json (fallbackLng is en).
 * Usage: node scripts/normalize-t-defaults.mjs [--write]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const write = process.argv.includes('--write');
const AR_RE = /[\u0600-\u06FF]/;

const exts = new Set(['.jsx', '.js', '.tsx', '.ts']);
const files = [];

function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (name === 'node_modules' || name === 'locales') continue;
            walk(full);
        } else if (exts.has(path.extname(name))) {
            files.push(full);
        }
    }
}

walk(path.join(root, 'src'));

let totalChanges = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = 0;

  // t('key', 'fallback') — skip if second arg is object (interpolation)
    content = content.replace(
        /\bt\(\s*(['"])([^'"]+)\1\s*,\s*(['"])([\s\S]*?)\3\s*\)/g,
        (match, q1, key, q2, fallback) => {
            if (fallback.includes('{') || fallback.includes('}')) return match;
            if (!AR_RE.test(fallback)) return match;
            const enVal = en[key];
            if (typeof enVal !== 'string') return match;
            changed += 1;
            if (!AR_RE.test(enVal)) {
                const esc = enVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `t('${key.replace(/'/g, "\\'")}')`;
            }
            return match;
        }
    );

    // defaultValue: 'arabic' inside t('key', { ... })
    content = content.replace(
        /(t\(\s*['"][^'"]+['"]\s*,\s*\{[^}]*?)defaultValue:\s*['"]([^'"]*)['"]/g,
        (match, prefix, fallback) => {
            if (!AR_RE.test(fallback)) return match;
            const keyMatch = prefix.match(/t\(\s*['"]([^'"]+)['"]/);
            if (!keyMatch) return match;
            const enVal = en[keyMatch[1]];
            if (typeof enVal === 'string' && !AR_RE.test(enVal)) {
                changed += 1;
                return `${prefix}defaultValue: '${enVal.replace(/'/g, "\\'")}'`;
            }
            changed += 1;
            return prefix.replace(/,\s*$/, '') + ' /* defaultValue removed */';
        }
    );

    if (changed > 0) {
        totalChanges += changed;
        const rel = path.relative(root, file);
        console.log(`${write ? 'UPDATED' : 'WOULD UPDATE'} ${rel}: ${changed} replacements`);
        if (write) fs.writeFileSync(file, content, 'utf8');
    }
}

console.log(write ? `Done. ${totalChanges} replacements.` : `Dry run: ${totalChanges} replacements. Pass --write to apply.`);
