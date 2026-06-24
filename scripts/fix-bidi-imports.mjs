#!/usr/bin/env node
/** Fix codemod artifact: merged `';import { AppText` onto previous import line. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
    path.join(ROOT, 'src/components'),
    path.join(ROOT, 'src/pages'),
    path.join(ROOT, 'src/admin'),
    path.join(ROOT, 'src/features'),
];

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (/\.(jsx|tsx|js)$/.test(e.name)) out.push(full);
    }
    return out;
}

function fixContent(code) {
    let next = code;
    // `from '...';import { AppText` → newline before import
    next = next.replace(/';import\s+\{/g, "';\nimport {");
    next = next.replace(/";import\s+\{/g, '";\nimport {');
    // `from\n'path';import` broken multiline from codemod
    next = next.replace(/(\n\s*'[^']+');import\s+\{/g, "$1;\nimport {");
    return next;
}

let changed = 0;
const files = TARGETS.flatMap((target) => walk(target));
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const out = fixContent(src);
    if (out !== src) {
        fs.writeFileSync(file, out, 'utf8');
        changed += 1;
        console.log('fixed:', path.relative(ROOT, file));
    }
}
console.log(`Done. ${changed} files.`);
