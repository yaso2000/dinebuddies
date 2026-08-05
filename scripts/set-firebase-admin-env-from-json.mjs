/**
 * Write Firebase Admin vars into .env from a service account JSON file.
 * Usage (CMD):
 *   node scripts/set-firebase-admin-env-from-json.mjs C:\path\to\service-account.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

const jsonPath = process.argv[2];
if (!jsonPath) {
    console.error('Usage: node scripts/set-firebase-admin-env-from-json.mjs <path-to-service-account.json>');
    process.exit(1);
}

const absJson = resolve(jsonPath);
if (!existsSync(absJson)) {
    console.error('File not found:', absJson);
    process.exit(1);
}

let sa;
try {
    sa = JSON.parse(readFileSync(absJson, 'utf8'));
} catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
}

const projectId = String(sa.project_id || '').trim();
const clientEmail = String(sa.client_email || '').trim();
const privateKeyId = String(sa.private_key_id || '').trim();
const privateKeyRaw = String(sa.private_key || '').trim();

if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('JSON must include project_id, client_email, and private_key');
    process.exit(1);
}

const privateKeyOneLine = privateKeyRaw.replace(/\r?\n/g, '\\n');

const updates = {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: clientEmail,
    FIREBASE_PRIVATE_KEY_ID: privateKeyId,
    FIREBASE_PRIVATE_KEY: `"${privateKeyOneLine}"`,
};

const keysToReplace = new Set(Object.keys(updates));
let lines = [];

if (existsSync(envPath)) {
    lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines = lines.filter((line) => {
        const key = line.split('=')[0]?.trim();
        return !keysToReplace.has(key);
    });
} else {
    console.log('Creating new .env at', envPath);
}

while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
}

lines.push('');
lines.push('# Firebase Admin (from service account JSON)');
for (const [key, value] of Object.entries(updates)) {
    if (key === 'FIREBASE_PRIVATE_KEY_ID' && !privateKeyId) continue;
    lines.push(`${key}=${value}`);
}
lines.push('');

writeFileSync(envPath, lines.join('\n'), 'utf8');

console.log('Updated .env:');
console.log('  FIREBASE_PROJECT_ID');
console.log('  FIREBASE_CLIENT_EMAIL');
if (privateKeyId) console.log('  FIREBASE_PRIVATE_KEY_ID');
console.log('  FIREBASE_PRIVATE_KEY');
console.log('');
console.log('Next: npm run verify:firebase-admin');
