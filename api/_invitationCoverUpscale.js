/**
 * Optional post-upscale for Gemini invitation cover (inline base64).
 *
 * Strategy (fail-open → always return usable bytes):
 * 1) If INVITE_COVER_UPSCALE is off → return original.
 * 2) If REPLICATE_API_TOKEN is set, mode allows it, and image ≤ 256KB (Replicate data-URL limit) → Real-ESRGAN via Replicate (Prefer: wait).
 * 3) Else → sharp Lanczos resize (~2×) + light sharpen (no extra API).
 * 4) Any error → return original.
 *
 * Env:
 * - INVITE_COVER_UPSCALE: empty (default on) | off | sharp | replicate | auto
 *   - auto (default): try replicate when token + size OK, else sharp
 *   - sharp: sharp only
 *   - replicate: replicate only (falls back to original if unavailable)
 * - REPLICATE_API_TOKEN: Bearer token for api.replicate.com
 * - INVITE_COVER_REPLICATE_SCALE: 2 or 4 (default 2)
 */

const REPLICATE_DATA_URL_MAX_BYTES = 256 * 1024;
const OUTPUT_MAX_LONG_EDGE = 2560;
const DEFAULT_SHARP_FACTOR = 2;
const REPLICATE_MODEL_PATH = 'nightmareai/real-esrgan';

function modeFromEnv() {
    const s = String(process.env.INVITE_COVER_UPSCALE ?? '')
        .trim()
        .toLowerCase();
    if (!s || s === 'auto' || s === '1' || s === 'true' || s === 'on') return 'auto';
    if (s === 'off' || s === '0' || s === 'false' || s === 'no' || s === 'disabled') return 'off';
    if (s === 'sharp') return 'sharp';
    if (s === 'replicate') return 'replicate';
    return 'auto';
}

function replicateScale() {
    const n = Math.floor(Number(process.env.INVITE_COVER_REPLICATE_SCALE));
    if (n === 4) return 4;
    return 2;
}

/**
 * @param {{ dataBase64: string, mimeType?: string }} input
 * @returns {Promise<{ dataBase64: string, mimeType: string, via: 'original'|'replicate'|'sharp' }>}
 */
export async function maybeUpscaleInvitationCover(input) {
    const dataBase64 = String(input?.dataBase64 || '').trim();
    const mimeType = String(input?.mimeType || 'image/png').trim() || 'image/png';
    const original = { dataBase64, mimeType, via: 'original' };

    if (!dataBase64) return original;

    const mode = modeFromEnv();
    if (mode === 'off') return original;

    const token = String(process.env.REPLICATE_API_TOKEN || '').trim();
    const buf = Buffer.from(dataBase64, 'base64');
    const canReplicate = token && buf.length > 0 && buf.length <= REPLICATE_DATA_URL_MAX_BYTES;

    const tryReplicate = (mode === 'replicate' || mode === 'auto') && canReplicate;

    if (tryReplicate) {
        const rep = await upscaleReplicate_(dataBase64, mimeType, token);
        if (rep) return rep;
        if (mode === 'replicate') return original;
    }

    if (mode === 'sharp' || mode === 'auto') {
        const sp = await upscaleSharp_(dataBase64, mimeType);
        if (sp) return sp;
    }

    return original;
}

/**
 * @param {string} dataBase64
 * @param {string} mimeType
 * @param {string} token
 */
async function upscaleReplicate_(dataBase64, mimeType, token) {
    try {
        const dataUri = `data:${mimeType};base64,${dataBase64}`;
        const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL_PATH}/predictions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'wait=55',
            },
            body: JSON.stringify({
                input: {
                    image: dataUri,
                    scale: replicateScale(),
                },
            }),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            console.warn('[invitation-cover-upscale] Replicate HTTP', res.status, t.slice(0, 200));
            return null;
        }
        const job = await res.json();
        const outUrl = typeof job?.output === 'string' ? job.output : null;
        if (!outUrl) {
            console.warn('[invitation-cover-upscale] Replicate no output', job?.status, job?.error);
            return null;
        }
        const imgRes = await fetch(outUrl);
        if (!imgRes.ok) return null;
        const outBuf = Buffer.from(await imgRes.arrayBuffer());
        if (!outBuf.length) return null;
        const outMime = imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
        return {
            dataBase64: outBuf.toString('base64'),
            mimeType: outMime.startsWith('image/') ? outMime : 'image/png',
            via: 'replicate',
        };
    } catch (e) {
        console.warn('[invitation-cover-upscale] Replicate', e?.message || e);
        return null;
    }
}

/**
 * @param {string} dataBase64
 * @param {string} mimeType
 */
async function upscaleSharp_(dataBase64, mimeType) {
    try {
        const sharp = (await import('sharp')).default;
        const input = Buffer.from(dataBase64, 'base64');
        if (!input.length) return null;

        const meta = await sharp(input).metadata();
        const w = meta.width || 512;
        const h = meta.height || 512;
        const long = Math.max(w, h);
        if (long >= OUTPUT_MAX_LONG_EDGE) return null;

        let tw = Math.round(w * DEFAULT_SHARP_FACTOR);
        let th = Math.round(h * DEFAULT_SHARP_FACTOR);
        const nextLong = Math.max(tw, th);
        if (nextLong > OUTPUT_MAX_LONG_EDGE) {
            const r = OUTPUT_MAX_LONG_EDGE / nextLong;
            tw = Math.max(1, Math.round(tw * r));
            th = Math.max(1, Math.round(th * r));
        }

        const base = sharp(input)
            .resize(tw, th, {
                kernel: sharp.kernel.lanczos3,
                fit: 'fill',
            })
            .sharpen({ sigma: 0.55, m1: 1, m2: 2 });

        const usePng = Boolean(meta.hasAlpha) || /png|webp/i.test(mimeType);
        const outBuf = usePng
            ? await base.png({ compressionLevel: 7 }).toBuffer()
            : await base.jpeg({ quality: 91, mozjpeg: true }).toBuffer();

        return {
            dataBase64: outBuf.toString('base64'),
            mimeType: usePng ? 'image/png' : 'image/jpeg',
            via: 'sharp',
        };
    } catch (e) {
        console.warn('[invitation-cover-upscale] sharp', e?.message || e);
        return null;
    }
}
