/**
 * Vite dev entry for `vercel dev`. Binds to Vercel's assigned PORT (required on Windows).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(viteBin)) {
    console.error('[vercel-vite-dev] Vite is not installed. Run: npm install');
    process.exit(1);
}

const port = String(process.env.PORT || '3000');
const viteArgs = [viteBin, '--host', '0.0.0.0', '--port', port, '--strictPort'];

const child = spawn(process.execPath, viteArgs, {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
});

child.on('error', (err) => {
    console.error('[vercel-vite-dev]', err);
    process.exit(1);
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 1);
});
