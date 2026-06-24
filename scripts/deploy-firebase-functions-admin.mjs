/**
 * @deprecated Prefer: node scripts/deploy-firebase-functions.mjs (CLI login first)
 * Force service account from .env — requires IAM Service Account User on appspot SA.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'deploy-firebase-functions.mjs');
const args = ['--sa', ...process.argv.slice(2)];

const result = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: process.env,
});

process.exit(result.status ?? 1);
