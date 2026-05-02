/**
 * Vercel build entry: either reuse an existing `dist/` (frozen prod mirror)
 * or run the normal ensure-maps + Vite production build.
 *
 * Set VERCEL_PREDIST=1 (or "true") for one-shot deploy of current dist/, e.g.:
 *   npx vercel --prod -b VERCEL_PREDIST=1
 */
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const predist =
    process.env.VERCEL_PREDIST === '1' ||
    String(process.env.VERCEL_PREDIST || '').toLowerCase() === 'true';

if (predist) {
    if (!existsSync('dist/index.html')) {
        console.error('[vercel-build] VERCEL_PREDIST: dist/index.html is missing.');
        process.exit(1);
    }
    if (!existsSync('dist/assets')) {
        console.error('[vercel-build] VERCEL_PREDIST: dist/assets is missing.');
        process.exit(1);
    }
    const files = readdirSync('dist/assets');
    if (files.length < 50) {
        console.error(
            `[vercel-build] VERCEL_PREDIST: dist/assets looks incomplete (${files.length} files).`
        );
        process.exit(1);
    }
    console.log(
        `[vercel-build] VERCEL_PREDIST: using existing dist/ (assets: ${files.length} files).`
    );
    process.exit(0);
}

const maps = spawnSync(process.execPath, ['scripts/ensure-maps-key-for-build.mjs'], {
    stdio: 'inherit',
    cwd: process.cwd(),
});
if (maps.status !== 0 && maps.status !== null) {
    process.exit(maps.status);
}

const vite = spawnSync('npx', ['vite', 'build'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true,
});
process.exit(vite.status === 0 || vite.status === null ? 0 : vite.status ?? 1);
