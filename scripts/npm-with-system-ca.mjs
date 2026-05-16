/**
 * Runs npm with NODE_OPTIONS=--use-system-ca so TLS trusts the OS / corporate CA store.
 * Use when `npm install` fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE on Windows.
 *
 *   node scripts/npm-with-system-ca.mjs install
 *   node scripts/npm-with-system-ca.mjs ci
 *   node scripts/npm-with-system-ca.mjs audit
 *   node scripts/npm-with-system-ca.mjs audit fix
 */
import { spawnSync } from 'node:child_process';

const extra = '--use-system-ca';
const cur = process.env.NODE_OPTIONS || '';
process.env.NODE_OPTIONS = [extra, cur].filter(Boolean).join(' ').trim();

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node scripts/npm-with-system-ca.mjs <npm-args...>');
    console.error('Example: node scripts/npm-with-system-ca.mjs install');
    process.exit(1);
}

const r = spawnSync('npm', args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS },
});

process.exit(r.status === null ? 1 : r.status);
