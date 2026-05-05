/**
 * Crop/resize Gemini cover to exact aspect (matches public invitation hero ratios).
 * Uses sharp "cover" from center so any model output size maps cleanly.
 */

/** @type {Record<'1:1'|'9:16', { width: number, height: number }>} */
const TARGET_PX = {
    '1:1': { width: 1080, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
};

/**
 * @param {{ dataBase64: string, mimeType?: string }} input
 * @param {'1:1'|'9:16'|'16:9'} aspectRatio — legacy "16:9" is normalized to 1:1
 * @returns {Promise<{ dataBase64: string, mimeType: string } | null>}
 */
export async function normalizeInvitationCoverAspect(input, aspectRatio) {
    const key = aspectRatio === '9:16' ? '9:16' : '1:1';
    const target = TARGET_PX[key];
    const dataBase64 = String(input?.dataBase64 || '').trim();
    if (!dataBase64) return null;

    try {
        const sharp = (await import('sharp')).default;
        const buf = Buffer.from(dataBase64, 'base64');
        if (!buf.length) return null;

        const outBuf = await sharp(buf)
            .rotate()
            .resize(target.width, target.height, {
                fit: 'cover',
                position: 'centre',
            })
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer();

        return {
            dataBase64: outBuf.toString('base64'),
            mimeType: 'image/jpeg',
        };
    } catch (e) {
        console.warn('[normalizeInvitationCoverAspect]', e?.message || e);
        return null;
    }
}
