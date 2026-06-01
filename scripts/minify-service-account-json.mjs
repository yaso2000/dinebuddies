/**
 * Minify service account JSON for Vercel FIREBASE_SERVICE_ACCOUNT_JSON.
 * Usage: node scripts/minify-service-account-json.mjs C:\keys\service-account.json
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
    console.error('Usage: node scripts/minify-service-account-json.mjs <path-to-json>');
    process.exit(1);
}

const sa = JSON.parse(readFileSync(path, 'utf8'));
console.log(JSON.stringify(sa));
