/**
 * Vercel build entry: either reuse an existing `dist/` (frozen prod mirror)
 * or run the normal ensure-maps + Vite production build.
 *
 * Set VERCEL_PREDIST=1 (or "true") for one-shot deploy of current dist/, e.g.:
 *   npx vercel --prod -b VERCEL_PREDIST=1
 */
import { existsSync, readdirSync, copyFileSync } from 'node:fs';
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
    const swSrc = 'public/firebase-messaging-sw.js';
    const swDest = 'dist/firebase-messaging-sw.js';
    if (!existsSync(swSrc)) {
        console.error('[vercel-build] VERCEL_PREDIST: public/firebase-messaging-sw.js is missing.');
        process.exit(1);
    }
    copyFileSync(swSrc, swDest);
    console.log('[vercel-build] VERCEL_PREDIST: copied firebase-messaging-sw.js → dist/ (must match app SDK).');
    process.exit(0);
}

const maps = spawnSync(process.execPath, ['scripts/ensure-maps-key-for-build.mjs'], {
    stdio: 'inherit',
    cwd: process.cwd(),
});
if (maps.status !== 0 && maps.status !== null) {
    process.exit(maps.status);
}

const privateTemplates = spawnSync(process.execPath, ['scripts/sync-private-invitation-templates.mjs'], {
    stdio: 'inherit',
    cwd: process.cwd()
});
if (privateTemplates.status !== 0 && privateTemplates.status !== null) {
    process.exit(privateTemplates.status);
}

const communityBannerTemplates = spawnSync(
    process.execPath,
    ['scripts/sync-community-banner-templates.mjs'],
    { stdio: 'inherit', cwd: process.cwd() }
);
if (communityBannerTemplates.status !== 0 && communityBannerTemplates.status !== null) {
    process.exit(communityBannerTemplates.status);
}

const vite = spawnSync('npx', ['vite', 'build'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true,
});
if (vite.status !== 0 && vite.status !== null) {
    process.exit(vite.status);
}

const swSrc = 'public/firebase-messaging-sw.js';
const swDest = 'dist/firebase-messaging-sw.js';
if (!existsSync(swSrc)) {
    console.error('[vercel-build] public/firebase-messaging-sw.js is missing.');
    process.exit(1);
}
copyFileSync(swSrc, swDest);
console.log('[vercel-build] copied firebase-messaging-sw.js → dist/');
process.exit(0);
