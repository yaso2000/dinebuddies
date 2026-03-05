import sharp from 'sharp';
import { readFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const sizes = [192, 512];
// 20% padding means the logo will be 60% of the total size in the center
const paddingPercentage = 0.20;

const icons = [
    {
        svgFile: resolve(publicDir, 'db dinebuddies.svg'),
        outputPrefix: 'icon-light',
        // White background
        background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
    {
        svgFile: resolve(publicDir, 'db-logo-white.svg'),
        outputPrefix: 'icon-dark',
        // Matching the exact DineBuddies dark theme background #0f172a
        background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
];

async function generate() {
    for (const icon of icons) {
        const svgBuffer = readFileSync(icon.svgFile);

        for (const size of sizes) {
            const padding = Math.round(size * paddingPercentage);
            const innerSize = size - (padding * 2);

            // 1. Trim the transparent space around the SVG and resize it to fit within innerSize
            // Using fit: 'inside' so it doesn't add any artifact padding pixels.
            const innerBuffer = await sharp(svgBuffer)
                .trim()
                .resize({ width: innerSize, height: innerSize, fit: 'inside' })
                .toBuffer();

            // 2. Create a perfect solid color background canvas of size x size
            // 3. Composite (stamp) the trimmed logo directly in the absolute center
            await sharp({
                create: {
                    width: size,
                    height: size,
                    channels: 4,
                    background: icon.background
                }
            })
                .composite([{ input: innerBuffer, gravity: 'center' }])
                .png()
                .toFile(resolve(publicDir, `${icon.outputPrefix}-${size}.png`));
        }
    }

    // Overwrite the canonical names fallback
    copyFileSync(resolve(publicDir, 'icon-light-512.png'), resolve(publicDir, 'icon-light.png'));
    copyFileSync(resolve(publicDir, 'icon-dark-512.png'), resolve(publicDir, 'icon-dark.png'));
    console.log('✅ Crystal clear composited icons generated!');
}

generate().catch(console.error);
