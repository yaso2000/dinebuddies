/**
 * Stories: remux uploaded MP4/MOV videos so the "moov atom" (frame index) sits at the
 * front of the file instead of the end. Phone-recorded videos are frequently written with
 * the moov atom at the end ("non-fast-start"), which forces a browser to fetch most/all of
 * the file before it can render any video frame at all — Chrome/Android just buffers for a
 * while, but Safari/iOS is stricter about it and can end up playing only the audio track
 * with no video ever appearing. This is a pure container remux (`-c copy`, no re-encoding),
 * so it's fast and doesn't touch video/audio quality.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

const FASTSTART_CONTENT_TYPES = new Set(['video/mp4', 'video/quicktime']);

let functionsLogger = console;

function remuxToFaststart(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions(['-c copy', '-movflags +faststart'])
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

function safeUnlink(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch {
        /* best effort cleanup */
    }
}

/**
 * @param {{
 *   exports: Record<string, unknown>,
 *   functions: typeof import('firebase-functions'),
 *   admin: typeof import('firebase-admin'),
 * }} deps
 */
function registerStoryVideoFaststart(deps) {
    const { exports, functions, admin } = deps;
    functionsLogger = functions.logger;

    const storageBucket =
        process.env.FIREBASE_STORAGE_BUCKET ||
        (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : null) ||
        'dinebuddies.firebasestorage.app';

    exports.remuxStoryVideoFaststart = functions
        .runWith({ timeoutSeconds: 120, memory: '512MB' })
        .storage.bucket(storageBucket)
        .object()
        .onFinalize(async (object) => {
            const filePath = object.name || '';
            if (!filePath.startsWith('stories/')) return null;

            const contentType = object.contentType || '';
            if (!FASTSTART_CONTENT_TYPES.has(contentType)) return null;

            // Our own re-upload after remuxing lands back on this same path and would
            // otherwise re-trigger this function forever — skip anything already tagged.
            if (object.metadata?.faststartProcessed === 'true') return null;

            const bucket = admin.storage().bucket(storageBucket);
            const file = bucket.file(filePath);
            const ext = path.extname(filePath) || '.mp4';
            const tmpIn = path.join(os.tmpdir(), `faststart-in-${Date.now()}${ext}`);
            const tmpOut = path.join(os.tmpdir(), `faststart-out-${Date.now()}${ext}`);

            try {
                await file.download({ destination: tmpIn });
                await remuxToFaststart(tmpIn, tmpOut);

                // Preserve the existing download token so the URL already saved to Firestore
                // (captured by the client right after its own upload finished) keeps working —
                // this is a silent in-place fix, not a new file the client needs to learn about.
                const [existingMeta] = await file.getMetadata();
                const existingCustomMeta = existingMeta.metadata || {};

                await bucket.upload(tmpOut, {
                    destination: filePath,
                    contentType,
                    metadata: {
                        metadata: {
                            ...existingCustomMeta,
                            faststartProcessed: 'true',
                        },
                    },
                });

                functionsLogger.info('remuxStoryVideoFaststart: remuxed', { filePath });
            } catch (err) {
                functionsLogger.error('remuxStoryVideoFaststart failed', {
                    filePath,
                    message: err?.message,
                });
            } finally {
                safeUnlink(tmpIn);
                safeUnlink(tmpOut);
            }
            return null;
        });
}

module.exports = { registerStoryVideoFaststart };
