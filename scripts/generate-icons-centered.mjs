import sharp from 'sharp';
import { readFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const sizes = [192, 512];
const paddingPercentage = 0.20;

const icons = [
    {
        svgFile: resolve(publicDir, 'db dinebuddies.svg'),
        outputPrefix: 'icon-light',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
    {
        svgFile: resolve(publicDir, 'db-logo-white.svg'),
        outputPrefix: 'icon-dark',
        background: { r: 2, g: 6, b: 23, alpha: 1 },
    },
];

async function generate() {
    for (const icon of icons) {
        const svgBuffer = readFileSync(icon.svgFile);

        for (const size of sizes) {
            const padding = Math.round(size * paddingPercentage);
            const innerSize = size - (padding * 2);

            // Using sharp.trim() to remove all empty space from the original SVG,
            // then explicitly setting the background color directly to ensure a
            // perfect square without any native SVG transparent bounding boxes interfering.
            await sharp(svgBuffer)
                .trim() // removes all transparent pixels around the logo exactly
                .resize(innerSize, innerSize, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // fit bounds exactly to innerSize
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
                .toFile(resolve(publicDir, `${icon.outputPrefix}-${size}.png`));
        }
    }

    copyFileSync(resolve(publicDir, 'icon-light-512.png'), resolve(publicDir, 'icon-light.png'));
    copyFileSync(resolve(publicDir, 'icon-dark-512.png'), resolve(publicDir, 'icon-dark.png'));
    console.log('✅ Centered icons generated!');
}

generate().catch(console.error);
