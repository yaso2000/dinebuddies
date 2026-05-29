/**
 * Run local Vercel CLI with Node's Windows/system CA store.
 * Fixes: "unable to verify the first certificate" on fetch to vercel.com.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vc = join(root, 'node_modules', 'vercel', 'dist', 'vc.js');

if (!existsSync(vc)) {
    console.error('Vercel CLI not installed. Run: npm install');
    process.exit(1);
}

const env = { ...process.env };
const extra = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : '';
if (!extra.includes('--use-system-ca')) {
    env.NODE_OPTIONS = `${extra}--use-system-ca`.trim();
}

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, ['--use-system-ca', vc, ...args], {
    stdio: 'inherit',
    cwd: root,
    env,
});

process.exit(result.status === null ? 1 : result.status);
