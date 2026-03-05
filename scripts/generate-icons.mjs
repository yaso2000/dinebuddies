/**
 * generate-icons.mjs
 * Converts the DineBuddies SVG logos into PWA-ready PNG icons.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const sizes = [192, 512];

const icons = [
    {
        // Light (day) — orange logo, white background
        svgFile: resolve(publicDir, 'db dinebuddies.svg'),
        outputPrefix: 'icon-light',
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // white
    },
    {
        // Dark (night) — white logo, dark background
        svgFile: resolve(publicDir, 'db-logo-white.svg'),
        outputPrefix: 'icon-dark',
        background: { r: 2, g: 6, b: 23, alpha: 1 }, // #020617
    },
];

for (const icon of icons) {
    const svgBuffer = readFileSync(icon.svgFile);

    for (const size of sizes) {
        const outPath = resolve(publicDir, `${icon.outputPrefix}-${size}.png`);

        await sharp(svgBuffer)
            .resize(size, size, {
                fit: 'contain',
                background: icon.background,
            })
            .flatten({ background: icon.background })
            .png()
            .toFile(outPath);

        console.log(`✅ ${outPath}`);
    }
}

// Also output the canonical names (512 as default)
import { copyFileSync } from 'fs';
copyFileSync(resolve(publicDir, 'icon-light-512.png'), resolve(publicDir, 'icon-light.png'));
copyFileSync(resolve(publicDir, 'icon-dark-512.png'), resolve(publicDir, 'icon-dark.png'));
console.log('✅ Canonical icon-light.png & icon-dark.png updated');
