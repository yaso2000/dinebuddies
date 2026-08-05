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
// Prefer CLI flag only — some Node builds (e.g. cloud agents) reject
// `--use-system-ca` inside NODE_OPTIONS.
if (env.NODE_OPTIONS && String(env.NODE_OPTIONS).includes('--use-system-ca')) {
    env.NODE_OPTIONS = String(env.NODE_OPTIONS)
        .replace(/--use-system-ca\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!env.NODE_OPTIONS) delete env.NODE_OPTIONS;
}

const args = process.argv.slice(2);
const nodeArgs = [];
try {
    // Keep Windows system-CA fix when the runtime supports the flag.
    const probe = spawnSync(process.execPath, ['--use-system-ca', '-e', ''], {
        encoding: 'utf8',
    });
    if (probe.status === 0) nodeArgs.push('--use-system-ca');
} catch {
    /* ignore */
}

const result = spawnSync(process.execPath, [...nodeArgs, vc, ...args], {
    stdio: 'inherit',
    cwd: root,
    env,
});

process.exit(result.status === null ? 1 : result.status);
