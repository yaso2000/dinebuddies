import sharp from 'sharp';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

// Original db dinebuddies.svg dimensions: viewBox="0 0 1544 1184"
// Let's create a perfectly square viewBox that includes a 20% margin.
// 1544 / 0.6 = 2574
// width & height = 2574.
// Object is 1544x1184. Center is 772, 592.
// New viewBox center should be 0,0 internally, or offset appropriately.
// X offset = (2574 - 1544) / 2 = 515
// Y offset = (2574 - 1184) / 2 = 695
// So viewBox should be "-515 -695 2574 2574"

const newViewBox = '-515 -695 2574 2574';

const icons = [
    {
        in: resolve(publicDir, 'db dinebuddies.svg'),
        outPrefix: 'icon-light',
        bg: '#ffffff'
    },
    {
        in: resolve(publicDir, 'db-logo-white.svg'),
        outPrefix: 'icon-dark',
        bg: '#0f172a' // the exact dark blue/navy of your app
    }
];

async function run() {
    for (let icon of icons) {
        let svgRaw = fs.readFileSync(icon.in, 'utf-8');
        // Replace the viewBox for padding
        svgRaw = svgRaw.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`);
        // Optional: strip width/height if present so sharp relies purely on resize
        svgRaw = svgRaw.replace(/width="[^"]+"/, '');
        svgRaw = svgRaw.replace(/height="[^"]+"/, '');

        const svgBuffer = Buffer.from(svgRaw);

        for (const size of [192, 512]) {
            const outPath = resolve(publicDir, `${icon.outPrefix}-${size}.png`);

            // Since the SVG is now a perfect square with built-in padding,
            // we just resize it directly on a solid background!
            await sharp(svgBuffer, { density: 300 })
                .resize(size, size)
                .flatten({ background: icon.bg })
                .png()
                .toFile(outPath);

            console.log(`Generated flawless ${outPath}`);
        }
    }

    fs.copyFileSync(resolve(publicDir, 'icon-light-512.png'), resolve(publicDir, 'icon-light.png'));
    fs.copyFileSync(resolve(publicDir, 'icon-dark-512.png'), resolve(publicDir, 'icon-dark.png'));
    console.log('✅ Final icons ready.');
}

run();
