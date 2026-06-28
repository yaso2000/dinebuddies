/**
 * PWA + iOS + Android icons — standard padding, centered db mark.
 *
 * Industry norm: logo ~70–75% of canvas width, equal margins (~12–15% each side).
 * Maskable icons use a smaller fill so Android/iOS squircle masks never clip the glyph.
 *
 * Run: npm run generate:icons
 */
import sharp from 'sharp';
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const SIZES = [180, 192, 512];

/** Vector source — white db mark on transparent/dark. */
const MARK_SOURCE = resolve(publicDir, 'db-logo-white.svg');

const BG_LIGHT = { r: 255, g: 255, b: 255, alpha: 255 };
const BG_DARK = { r: 15, g: 23, b: 42, alpha: 255 };

/** Logo canvas fill for purpose:any (~15% margin each side after wide-glyph scaling). */
const ANY_FILL_RATIO = 0.78;
/** Maskable safe zone — keeps glyph inside squircle/circle masks on Android. */
const MASKABLE_FILL_RATIO = 0.65;
/** Internal padding around glyph bbox inside the square mark. */
const GLYPH_PAD_RATIO = 0.04;
/** Expected horizontal margin band on a 192px icon (px). */
const TARGET_MARGIN_192 = { min: 22, max: 36 };

function isGlyphPixel(r, g, b, a, mode) {
    if (a < 30) return false;
    if (mode === 'white') return r > 200 && g > 200 && b > 200;
    return r > 130 && g > 55 && b < 140 && r > b + 20;
}

/**
 * Render SVG → square mark with glyph centered (bbox + centroid aligned).
 * @param {'orange' | 'white'} glyphColor
 */
async function buildSquareMark(glyphColor) {
    const { data, info } = await sharp(MARK_SOURCE, { density: 300 })
        .resize(1024, null, { withoutEnlargement: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * channels;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = channels >= 4 ? data[i + 3] : 255;
            if (!isGlyphPixel(r, g, b, a, 'white')) continue;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX <= minX || maxY <= minY) {
        throw new Error('Could not detect db glyph in db-logo-white.svg');
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const core = Math.max(boxW, boxH);
    const square = Math.ceil(core * (1 + GLYPH_PAD_RATIO * 2));

    const pasteX = Math.floor((square - boxW) / 2);
    const pasteY = Math.floor((square - boxH) / 2);

    const [gr, gg, gb] =
        glyphColor === 'white' ? [255, 255, 255] : [232, 110, 46];

    const mark = Buffer.alloc(square * square * 4, 0);

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const si = (y * width + x) * channels;
            const r = data[si];
            const g = data[si + 1];
            const b = data[si + 2];
            const a = channels >= 4 ? data[si + 3] : 255;
            if (!isGlyphPixel(r, g, b, a, 'white')) continue;

            const dx = pasteX + (x - minX);
            const dy = pasteY + (y - minY);
            if (dx < 0 || dy < 0 || dx >= square || dy >= square) continue;

            const di = (dy * square + dx) * 4;
            mark[di] = gr;
            mark[di + 1] = gg;
            mark[di + 2] = gb;
            mark[di + 3] = 255;
        }
    }

    return sharp(mark, { raw: { width: square, height: square, channels: 4 } })
        .png()
        .toBuffer();
}

async function buildIcon(markBuffer, size, background, fillRatio) {
    const markSize = Math.max(1, Math.round(size * fillRatio));
    const offset = Math.round((size - markSize) / 2);
    const bgHex = `#${[background.r, background.g, background.b]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')}`;

    const markLayer = await sharp(markBuffer)
        .resize(markSize, markSize, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();

    return sharp({
        create: { width: size, height: size, channels: 4, background },
    })
        .composite([{ input: markLayer, left: offset, top: offset }])
        .flatten({ background: bgHex })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

async function buildSplash(width, height, iconBuffer, background) {
    const size = Math.round(Math.min(width, height) * 0.4);
    const icon = await sharp(iconBuffer).resize(size, size).png().toBuffer();
    const left = Math.round((width - size) / 2);
    const top = Math.round((height - size) / 2);
    const bgHex = `#${[background.r, background.g, background.b]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')}`;

    return sharp({
        create: { width, height, channels: 4, background },
    })
        .composite([{ input: icon, left, top }])
        .flatten({ background: bgHex })
        .png()
        .toBuffer();
}

async function measureGlyphMargins(pngPath, isGlyph) {
    const { data, info } = await sharp(pngPath).raw().toBuffer({ resolveWithObject: true });
    let minX = info.width;
    let minY = info.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const i = (y * info.width + x) * info.channels;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (!isGlyph(r, g, b)) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < minX) return null;
    const w = info.width;
    const h = info.height;
    return {
        margins: { L: minX, R: w - 1 - maxX, T: minY, B: h - 1 - maxY },
        glyphSize: { w: maxX - minX + 1, h: maxY - minY + 1 },
    };
}

async function main() {
    if (!existsSync(MARK_SOURCE)) {
        throw new Error(`Missing ${MARK_SOURCE}`);
    }

    const themes = [
        { outputPrefix: 'icon-light', background: BG_LIGHT, glyph: 'orange' },
        { outputPrefix: 'icon-dark', background: BG_DARK, glyph: 'white' },
    ];

    for (const theme of themes) {
        const markBuffer = await buildSquareMark(theme.glyph);

        for (const size of SIZES) {
            const outPath = resolve(publicDir, `${theme.outputPrefix}-${size}.png`);
            const png = await buildIcon(markBuffer, size, theme.background, ANY_FILL_RATIO);
            await sharp(png).toFile(outPath);
            console.log(`✅ ${outPath}`);

            const maskPath = resolve(publicDir, `${theme.outputPrefix}-maskable-${size}.png`);
            const maskPng = await buildIcon(
                markBuffer,
                size,
                theme.background,
                MASKABLE_FILL_RATIO
            );
            await sharp(maskPng).toFile(maskPath);
            console.log(`✅ ${maskPath}`);
        }

        copyFileSync(
            resolve(publicDir, `${theme.outputPrefix}-512.png`),
            resolve(publicDir, `${theme.outputPrefix}.png`)
        );
    }

    const darkM = await measureGlyphMargins(
        resolve(publicDir, 'icon-dark-192.png'),
        (r, g, b) => r > 200
    );
    const maskM = await measureGlyphMargins(
        resolve(publicDir, 'icon-dark-maskable-192.png'),
        (r, g, b) => r > 200
    );
    console.log('icon-dark-192 margins', darkM);
    console.log('icon-dark-maskable-192 margins', maskM);

    for (const [label, m] of [
        ['icon-dark-192', darkM],
        ['icon-dark-maskable-192', maskM],
    ]) {
        if (!m) continue;
        const { L, R } = m.margins;
        if (Math.abs(L - R) > 2) {
            console.warn(`⚠️  ${label}: uneven horizontal margins L=${L} R=${R}`);
        }
        if (label === 'icon-dark-192' && (L < TARGET_MARGIN_192.min || L > TARGET_MARGIN_192.max)) {
            console.warn(
                `⚠️  ${label}: horizontal margin ${L}px outside target ${TARGET_MARGIN_192.min}-${TARGET_MARGIN_192.max}px`
            );
        }
    }

    const dark512 = await sharp(resolve(publicDir, 'icon-dark-512.png')).toBuffer();
    await sharp(await buildSplash(1080, 1920, dark512, BG_DARK)).toFile(
        resolve(publicDir, 'splash-dark.png')
    );
    console.log('✅ public/splash-dark.png');

    const light512 = await sharp(resolve(publicDir, 'icon-light-512.png')).toBuffer();
    await sharp(await buildSplash(1080, 1920, light512, BG_LIGHT)).toFile(
        resolve(publicDir, 'splash-light.png')
    );
    console.log('✅ public/splash-light.png');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
