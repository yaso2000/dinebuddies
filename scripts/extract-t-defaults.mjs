#!/usr/bin/env node
/**
 * Extract t() keys + defaults from src (string and defaultValue forms).
 * Writes scripts/_extracted-t-defaults.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** @type {Map<string, { en?: string, ar?: string }>} */
const keyDefaults = new Map();

function note(key, text) {
    if (!key || !text) return;
    if (!keyDefaults.has(key)) keyDefaults.set(key, {});
    const slot = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
    const bucket = keyDefaults.get(key);
    if (!bucket[slot]) bucket[slot] = text;
}

function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (name !== 'node_modules' && name !== 'locales') walk(full);
        } else if (/\.(jsx?|tsx?)$/.test(name)) {
            scanFile(full);
        }
    }
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    const stringRe = /\bt\(\s*['"]([^'"]+)['"]\s*,\s*['"`]([^'"`]*(?:\\.[^'"`]*)*)['"`]/g;
    let m;
    while ((m = stringRe.exec(content))) note(m[1], m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));

    const defaultValueRe =
        /\bt\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*defaultValue:\s*['"`]([^'"`]*(?:\\.[^'"`]*)*)['"`]/gs;
    while ((m = defaultValueRe.exec(content))) note(m[1], m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));

    const nameDefaultRe =
        /\bt\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*name:\s*[^,}]+[^}]*defaultValue:\s*['"`]([^'"`]*(?:\\.[^'"`]*)*)['"`]/gs;
    while ((m = nameDefaultRe.exec(content))) note(m[1], m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
}

walk(path.join(ROOT, 'src'));

fs.writeFileSync(
    path.join(__dirname, '_extracted-t-defaults.json'),
    JSON.stringify(Object.fromEntries(keyDefaults), null, 2)
);
console.log('extracted keys with defaults:', keyDefaults.size);
