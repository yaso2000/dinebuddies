/**
 * Production deploy via Vercel CLI (system CA on Windows).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const vercelCli = join(scriptsDir, 'vercel-cli.mjs');
const deployArgs = ['--prod'];
if (process.argv.includes('--predist')) {
    deployArgs.push('-b', 'VERCEL_PREDIST=1');
}

const result = spawnSync(process.execPath, [vercelCli, ...deployArgs], {
    stdio: 'inherit',
    env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
