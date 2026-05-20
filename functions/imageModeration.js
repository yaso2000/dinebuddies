/**
 * Image moderation via Google Cloud Vision Safe Search.
 * Flow: client uploads to quarantine/ → moderateImage callable → copy to public path or reject.
 */
const crypto = require('crypto');
const vision = require('@google-cloud/vision');

const LIKELIHOOD_RANK = {
    UNKNOWN: 0,
    VERY_UNLIKELY: 1,
    UNLIKELY: 2,
    POSSIBLE: 3,
    LIKELY: 4,
    VERY_LIKELY: 5,
};

/** @param {string} purpose @param {string} uid @param {string} ext */
function resolveModeratedDestPath(purpose, uid, ext) {
    const ts = Date.now();
    const safeExt = ext === 'jpeg' ? 'jpg' : ext || 'jpg';
    switch (purpose) {
        case 'chat':
        case 'chat_public':
            return `chat_images/${uid}/${uid}_${ts}.jpg`;
        case 'invitation':
            return `invitations/${uid}/${ts}_image.${safeExt}`;
        case 'thumbnail':
            return `invitations/${uid}/${ts}_thumbnail.jpg`;
        case 'post':
            return `community-posts/${uid}/post_${ts}.jpg`;
        case 'story':
            return `stories/${uid}/${ts}.jpg`;
        case 'avatar':
            return `avatars/${uid}_${ts}.jpg`;
        case 'cover':
            return `covers/${uid}/cover_${ts}.jpg`;
        case 'logo':
            return `logos/${uid}/logo_${ts}.jpg`;
        case 'gallery':
            return `gallery/${uid}/${ts}.jpg`;
        case 'menu':
            return `menus/${uid}/${ts}.jpg`;
        case 'offer':
            return `offers/${uid}_${ts}.jpg`;
        case 'premium_offer':
            return `premium_offers/${uid}_${ts}.jpg`;
        case 'business':
            return `business_photos/${uid}/${ts}.jpg`;
        case 'place':
            return `users/${uid}/places/${ts}.jpg`;
        case 'featured':
            return `featured_posts/${uid}/${ts}.jpg`;
        default:
            return `community-posts/${uid}/upload_${ts}.jpg`;
    }
}

const ALLOWED_PURPOSES = new Set([
    'chat',
    'chat_public',
    'invitation',
    'thumbnail',
    'post',
    'story',
    'avatar',
    'cover',
    'logo',
    'gallery',
    'menu',
    'offer',
    'premium_offer',
    'business',
    'place',
    'featured',
]);

const STORAGE_GUARD_PREFIXES = [
    'chat_images/',
    'invitations/',
    'community-posts/',
    'stories/',
    'gallery/',
    'menus/',
    'covers/',
    'logos/',
    'avatars/',
    'offers/',
    'premium_offers/',
    'business_photos/',
    'featured_posts/',
    'users/',
];

function likelihoodAtLeast(value, threshold) {
    const v = LIKELIHOOD_RANK[value] ?? 0;
    const t = LIKELIHOOD_RANK[threshold] ?? 99;
    return v >= t;
}

function isSafeSearchAllowed(safe) {
    if (!safe || typeof safe !== 'object') return false;
    if (likelihoodAtLeast(safe.adult, 'LIKELY')) return false;
    if (likelihoodAtLeast(safe.violence, 'LIKELY')) return false;
    if (likelihoodAtLeast(safe.racy, 'VERY_LIKELY')) return false;
    return true;
}

function buildPublicDownloadUrl(bucketName, objectPath, token) {
    const encoded = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

async function ensureDownloadToken(file) {
    const [meta] = await file.getMetadata();
    const custom = meta.metadata || {};
    let token = custom.firebaseStorageDownloadTokens;
    if (!token) {
        token = crypto.randomUUID();
        await file.setMetadata({
            metadata: {
                ...custom,
                firebaseStorageDownloadTokens: token,
            },
        });
    }
    return token;
}

/**
 * @param {import('firebase-admin')} admin
 * @param {string} bucketName
 * @param {string} objectPath
 */
async function runSafeSearchDetection(bucketName, objectPath) {
    if (process.env.IMAGE_MODERATION_DISABLED === 'true') {
        console.warn('[imageModeration] IMAGE_MODERATION_DISABLED=true — skipping Vision scan');
        return { skipped: true, safe: {} };
    }

    const client = new vision.ImageAnnotatorClient();
    const gcsUri = `gs://${bucketName}/${objectPath}`;
    const [result] = await client.safeSearchDetection(gcsUri);
    const safe = result?.safeSearchAnnotation || null;
    return { skipped: false, safe };
}

// Lazy logger reference set in register
let functionsLogger = console;

/**
 * @param {{
 *   exports: Record<string, unknown>,
 *   functions: typeof import('firebase-functions'),
 *   db: FirebaseFirestore.Firestore,
 *   admin: typeof import('firebase-admin'),
 *   enforceCallableRateLimit: (uid: string, bucket: string, limits?: object) => Promise<void>,
 * }} deps
 */
function registerImageModeration(deps) {
    const { exports, functions, db, admin, enforceCallableRateLimit } = deps;
    functionsLogger = functions.logger;

    const getBucket = () => admin.storage().bucket();

    async function recordModerationStrike(uid, { purpose, quarantinePath, safe }) {
        const strikeRef = db.collection('users').doc(uid).collection('moderation_strikes').doc();
        await strikeRef.set({
            type: 'image_rejected',
            purpose: purpose || null,
            quarantinePath,
            safeSearch: safe || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection('users').doc(uid).set(
            {
                imageModerationStrikeCount: admin.firestore.FieldValue.increment(1),
                lastImageModerationStrikeAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }

    exports.moderateImage = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'moderate_image', {
            perMinute: 15,
            perHour: 80,
            perDay: 200,
            cooldownMs: 1500,
        });

        const quarantinePath = typeof data?.quarantinePath === 'string' ? data.quarantinePath.trim() : '';
        const purpose = typeof data?.purpose === 'string' ? data.purpose.trim() : '';

        if (!quarantinePath || !quarantinePath.startsWith(`quarantine/${uid}/`)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Invalid quarantine path for this user.'
            );
        }
        if (!ALLOWED_PURPOSES.has(purpose)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid moderation purpose.');
        }

        const bucket = getBucket();
        const srcFile = bucket.file(quarantinePath);
        const [exists] = await srcFile.exists();
        if (!exists) {
            throw new functions.https.HttpsError('not-found', 'Upload not found. Please try again.');
        }

        const [srcMeta] = await srcFile.getMetadata();
        const contentType = srcMeta.contentType || '';
        if (!contentType.startsWith('image/')) {
            try {
                await srcFile.delete();
            } catch (_) { /* ignore */ }
            throw new functions.https.HttpsError('invalid-argument', 'Only image files are allowed.');
        }

        let safe = null;
        try {
            const detection = await runSafeSearchDetection(bucket.name, quarantinePath);
            safe = detection.safe;
            if (!detection.skipped && !isSafeSearchAllowed(safe)) {
                await recordModerationStrike(uid, { purpose, quarantinePath, safe });
                try {
                    await srcFile.delete();
                } catch (_) { /* ignore */ }
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Image violates content policy.',
                    { reason: 'image-rejected' }
                );
            }
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            functionsLogger.error('Vision Safe Search failed', err);
            try {
                await srcFile.delete();
            } catch (_) { /* ignore */ }
            throw new functions.https.HttpsError(
                'unavailable',
                'Image moderation is temporarily unavailable. Please try again later.',
                { reason: 'moderation-unavailable' }
            );
        }

        const extMatch = quarantinePath.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
        const destPath = resolveModeratedDestPath(purpose, uid, ext);
        const destFile = bucket.file(destPath);

        const [buffer] = await srcFile.download();
        const approvalMeta = {
            moderationStatus: 'approved',
            moderatedAt: new Date().toISOString(),
            moderatedBy: 'vision-safe-search',
            moderationPurpose: purpose,
            uploadedBy: uid,
        };
        await destFile.save(buffer, {
            contentType: contentType || 'image/jpeg',
            metadata: {
                metadata: approvalMeta,
            },
        });

        try {
            await srcFile.delete();
        } catch (delErr) {
            functionsLogger.warn('Could not delete quarantine file after copy', delErr?.message);
        }

        const token = await ensureDownloadToken(destFile);
        const url = buildPublicDownloadUrl(bucket.name, destPath, token);

        return { success: true, url, path: destPath };
    });

    const storageBucket =
        process.env.FIREBASE_STORAGE_BUCKET ||
        (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : null) ||
        'dinebuddies.firebasestorage.app';

    // Safety net: delete direct uploads to public image paths without approval metadata.
    exports.enforceApprovedImageUpload = functions.storage
        .bucket(storageBucket)
        .object()
        .onFinalize(async (object) => {
            const filePath = object.name || '';
            if (!filePath) return null;

            const bucket = getBucket();

            const isPublicImagePath = STORAGE_GUARD_PREFIXES.some((prefix) => filePath.startsWith(prefix));
            if (!isPublicImagePath) return null;

            const contentType = object.contentType || '';
            if (!contentType.startsWith('image/')) return null;

            const custom = object.metadata || {};
            if (custom.moderationStatus === 'approved') return null;

            functionsLogger.warn('Removing unmoderated public image upload', { filePath });
            try {
                await bucket.file(filePath).delete();
            } catch (err) {
                if (err.code !== 404) {
                    functionsLogger.error('Failed to delete unmoderated image', err);
                }
            }
            return null;
        });
}

module.exports = { registerImageModeration, isSafeSearchAllowed };
