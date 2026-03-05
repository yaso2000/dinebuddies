import sharp from 'sharp';
import { readFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const sizes = [192, 512];
// Safe area margin: ~20% of the image size
// This means the logo itself takes up 60% of the space
const paddingPercentage = 0.20;

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

async function generate() {
    for (const icon of icons) {
        const svgBuffer = readFileSync(icon.svgFile);

        for (const size of sizes) {
            const padding = Math.round(size * paddingPercentage);
            const innerSize = size - (padding * 2);
            const outPath = resolve(publicDir, `${icon.outputPrefix}-${size}.png`);

            await sharp(svgBuffer)
                .resize(innerSize, innerSize, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent inner background
                })
                .extend({
                    top: padding,
                    bottom: padding,
                    left: padding,
                    right: padding,
                    background: icon.background
                })
                .flatten({ background: icon.background })
                .png()
                .toFile(outPath);

            console.log(`✅ ${outPath}`);
        }
    }

    // Also output the canonical names (512 as default)
    copyFileSync(resolve(publicDir, 'icon-light-512.png'), resolve(publicDir, 'icon-light.png'));
    copyFileSync(resolve(publicDir, 'icon-dark-512.png'), resolve(publicDir, 'icon-dark.png'));
    console.log('✅ Canonical icon-light.png & icon-dark.png updated (with 20% padding)');
}

generate().catch(console.error);
