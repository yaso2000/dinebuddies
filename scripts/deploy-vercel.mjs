/**
 * Vercel deploy with Node system CA store (fixes "unable to verify the first certificate" on Windows).
 */
import { spawnSync } from 'node:child_process';

const extra = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : '';
if (!extra.includes('--use-system-ca')) {
    process.env.NODE_OPTIONS = `${extra}--use-system-ca`.trim();
}

const args = ['vercel', '--prod', ...(process.argv.includes('--predist') ? ['-b', 'VERCEL_PREDIST=1'] : [])];

const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
