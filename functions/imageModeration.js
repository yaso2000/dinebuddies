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

// NSFW block thresholds — tunable via env (redeploy to change). An image is
// REJECTED when a category's likelihood is at least the threshold below.
// Defaults tightened: block clearly adult/nude content (LIKELY+) and overtly
// sexual "racy" content (VERY_LIKELY), while still allowing ordinary photos
// (dining, beach, light clothing register as POSSIBLE/LIKELY racy). Set a
// threshold to 'OFF' to ignore that category.
const NSFW_THRESHOLDS = {
    adult: (process.env.NSFW_ADULT_THRESHOLD || 'LIKELY').toUpperCase(),
    racy: (process.env.NSFW_RACY_THRESHOLD || 'VERY_LIKELY').toUpperCase(),
    violence: (process.env.NSFW_VIOLENCE_THRESHOLD || 'LIKELY').toUpperCase(),
    medical: (process.env.NSFW_MEDICAL_THRESHOLD || 'OFF').toUpperCase(),
};

function thresholdBlocks(value, threshold) {
    if (!threshold || threshold === 'OFF') return false;
    return likelihoodAtLeast(value, threshold);
}

/** @param {string} purpose @param {string} uid @param {string} ext */
function resolveModeratedDestPath(purpose, uid, ext) {
    const ts = Date.now();
    const safeExt = ext === 'jpeg' ? 'jpg' : ext || 'jpg';
    switch (purpose) {
        case 'chat':
        case 'chat_public':
        case 'social_dm':
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
        case 'dating_photo':
            return `dating_photos/${uid}_${ts}.jpg`;
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
        case 'realornai_photo':
            // "Real or AI?" game camera photo — distinct prefix so the server can
            // derive the true source from the path (see realOrAiPost.js).
            return `realornai-photos/${uid}/${ts}.jpg`;
        case 'ai_edit_input':
            // Reusable AI image-edit input (moderated before editing). Faces allowed.
            return `ai-edit-inputs/${uid}/${ts}.jpg`;
        default:
            return `community-posts/${uid}/upload_${ts}.jpg`;
    }
}

const ALLOWED_PURPOSES = new Set([
    'chat',
    'chat_public',
    'social_dm',
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
    'dating_photo',
    'realornai_photo',
    'ai_edit_input',
]);

// Profile photos must contain a human face (Vision FACE_DETECTION). Tunable via env:
//  FACE_REQUIRED_PURPOSES — comma list of purposes requiring a face (default 'avatar')
//  FACE_MIN_CONFIDENCE    — 0..1 minimum detection confidence (default 0.5)
//  FACE_REQUIRED_DISABLED — 'true' turns the whole face requirement off
const FACE_REQUIRED_PURPOSES = new Set(
    (process.env.FACE_REQUIRED_PURPOSES || 'avatar,dating_photo')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
);
const FACE_MIN_CONFIDENCE = Number(process.env.FACE_MIN_CONFIDENCE || 0.5);

// Anti-spam / cost control: cap how many face-gated photos (avatar / dating)
// one user can upload per hour + per day, since each runs Vision. Tunable via env.
const FACE_UPLOAD_PER_HOUR = Number(process.env.FACE_UPLOAD_PER_HOUR || 3);
const FACE_UPLOAD_PER_DAY = Number(process.env.FACE_UPLOAD_PER_DAY || 3);

// "Camera or AI?" game selfie purposes — the whole game is "guess if this selfie
// is a real camera shot or AI-edited", so a clear human face is MANDATORY here
// (never disable-able by env). Repeated non-selfie uploads (messing around) are
// escalated: notice → warning → 24h block from the game (see the strike logic in
// registerImageModeration). Given legit play involves several shots, these use a
// more generous rate limit than avatar/dating photos.
const GAME_SELFIE_PURPOSES = new Set(['realornai_photo', 'ai_edit_input']);
const GAME_STRIKE_BLOCK_MS = 24 * 60 * 60 * 1000; // 3rd strike → blocked 24h
const GAME_STRIKE_DECAY_MS = 24 * 60 * 60 * 1000; // strikes older than this reset
const GAME_SELFIE_PER_HOUR = Number(process.env.CAM_AI_SELFIE_PER_HOUR || 20);
const GAME_SELFIE_PER_DAY = Number(process.env.CAM_AI_SELFIE_PER_DAY || 40);

function isGameSelfiePurpose(purpose) {
    return GAME_SELFIE_PURPOSES.has(purpose);
}

function purposeRequiresFace(purpose) {
    if (isGameSelfiePurpose(purpose)) return true; // mandatory for the game
    if (process.env.FACE_REQUIRED_DISABLED === 'true') return false;
    return FACE_REQUIRED_PURPOSES.has(purpose);
}

function hasHumanFace(faces) {
    if (!Array.isArray(faces) || faces.length === 0) return false;
    return faces.some((f) => {
        const c = typeof f?.detectionConfidence === 'number' ? f.detectionConfidence : 1;
        return c >= FACE_MIN_CONFIDENCE;
    });
}

// Paths clients might write to directly. Profile media (avatars/covers/logos/gallery)
// is omitted — only moderateImage (Admin SDK) writes those after Vision approval.
const STORAGE_GUARD_PREFIXES = [
    'chat_images/',
    'chat_files/', // guard images dropped here (non-image attachments like PDFs are untouched)
    'invitations/',
    'community-posts/',
    'stories/',
    'menus/',
    'offers/',
    'premium_offers/',
    'business_photos/',
    'featured_posts/',
    'users/',
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isModerationApproved(customMeta) {
    const custom = customMeta && typeof customMeta === 'object' ? customMeta : {};
    return (
        custom.moderationStatus === 'approved' ||
        custom.moderatedBy === 'vision-safe-search'
    );
}

function likelihoodAtLeast(value, threshold) {
    const v = LIKELIHOOD_RANK[value] ?? 0;
    const t = LIKELIHOOD_RANK[threshold] ?? 99;
    return v >= t;
}

function isSafeSearchAllowed(safe) {
    if (!safe || typeof safe !== 'object') return false;
    // Tightened porn filter: reject clearly adult/nude (LIKELY+) and overtly
    // sexual racy content (VERY_LIKELY); violence LIKELY+. Thresholds tunable via
    // NSFW_* env vars (see NSFW_THRESHOLDS).
    if (thresholdBlocks(safe.adult, NSFW_THRESHOLDS.adult)) return false;
    if (thresholdBlocks(safe.racy, NSFW_THRESHOLDS.racy)) return false;
    if (thresholdBlocks(safe.violence, NSFW_THRESHOLDS.violence)) return false;
    if (thresholdBlocks(safe.medical, NSFW_THRESHOLDS.medical)) return false;
    return true;
}

function buildPublicDownloadUrl(bucketName, objectPath, token) {
    const encoded = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

/** Extract the storage object path from a Firebase Storage download URL (…/o/{encoded}?…). */
function storagePathFromDownloadUrl(url) {
    try {
        const m = String(url || '').match(/\/o\/([^?]+)/);
        return m ? decodeURIComponent(m[1]) : null;
    } catch (_) {
        return null;
    }
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
async function runVisionModeration(bucketName, objectPath, { detectFace = false } = {}) {
    // Fail-secure: never skip Vision. IMAGE_MODERATION_DISABLED must not bypass checks.
    if (process.env.IMAGE_MODERATION_DISABLED === 'true') {
        const err = new Error('IMAGE_MODERATION_DISABLED is not allowed — moderation is mandatory.');
        err.code = 'moderation-required';
        throw err;
    }

    const client = new vision.ImageAnnotatorClient();
    const gcsUri = `gs://${bucketName}/${objectPath}`;
    // One request for both checks: SafeSearch (always) + Face (only when required).
    const features = [{ type: 'SAFE_SEARCH_DETECTION' }];
    if (detectFace) features.push({ type: 'FACE_DETECTION', maxResults: 5 });
    const [result] = await client.annotateImage({
        image: { source: { imageUri: gcsUri } },
        features,
    });
    const safe = result?.safeSearchAnnotation || null;
    if (!safe || typeof safe !== 'object') {
        const err = new Error('Vision returned no SafeSearch annotation.');
        err.code = 'moderation-unavailable';
        throw err;
    }
    const faces = Array.isArray(result?.faceAnnotations) ? result.faceAnnotations : [];
    return { safe, faces };
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

    // ---- "Camera or AI?" game anti-abuse: non-selfie uploads escalate ----------
    async function assertNotGameBlocked(uid) {
        const snap = await db.collection('users').doc(uid).get();
        const d = snap.exists ? snap.data() : {};
        const until = d?.camAiGameBlockedUntil?.toMillis?.() ?? Number(d?.camAiGameBlockedUntil) ?? 0;
        if (until && until > Date.now()) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'You are temporarily blocked from this game for repeated misuse.',
                { reason: 'game-blocked', level: 3, blockedUntil: until }
            );
        }
    }

    /** Record a non-selfie strike and return the escalation { level, blockedUntil }. */
    async function applyGameSelfieStrike(uid) {
        const userRef = db.collection('users').doc(uid);
        return db.runTransaction(async (tx) => {
            const snap = await tx.get(userRef);
            const d = snap.exists ? snap.data() : {};
            const lastAt = d?.camAiLastStrikeAt?.toMillis?.() ?? 0;
            const decayed = lastAt > 0 && Date.now() - lastAt > GAME_STRIKE_DECAY_MS;
            const current = decayed ? 0 : Number(d?.camAiSelfieStrikes) || 0;
            const next = current + 1;
            if (next >= 3) {
                const until = Date.now() + GAME_STRIKE_BLOCK_MS;
                tx.set(
                    userRef,
                    {
                        camAiSelfieStrikes: 0,
                        camAiLastStrikeAt: admin.firestore.FieldValue.serverTimestamp(),
                        camAiGameBlockedUntil: admin.firestore.Timestamp.fromMillis(until),
                    },
                    { merge: true }
                );
                return { level: 3, blockedUntil: until };
            }
            tx.set(
                userRef,
                {
                    camAiSelfieStrikes: next,
                    camAiLastStrikeAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { level: next, blockedUntil: 0 };
        });
    }

    /** A good selfie forgives prior strikes. */
    async function clearGameSelfieStrikes(uid) {
        try {
            await db.collection('users').doc(uid).set({ camAiSelfieStrikes: 0 }, { merge: true });
        } catch (_) { /* best effort */ }
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
        const needFace = purposeRequiresFace(purpose);
        const isGameSelfie = isGameSelfiePurpose(purpose);
        // "Camera or AI?" game: reject uploads from a user under an active abuse
        // penalty up front, and give legit players a more generous face-photo cap.
        if (isGameSelfie) {
            await assertNotGameBlocked(uid);
            await enforceCallableRateLimit(uid, 'cam_ai_selfie', {
                perHour: GAME_SELFIE_PER_HOUR,
                perDay: GAME_SELFIE_PER_DAY,
                cooldownMs: 1500,
            });
        } else if (needFace) {
            // Tighter daily cap on profile/dating photo uploads (each runs Vision face detection).
            await enforceCallableRateLimit(uid, 'moderate_face_photo', {
                perHour: FACE_UPLOAD_PER_HOUR,
                perDay: FACE_UPLOAD_PER_DAY,
                cooldownMs: 3000,
            });
        }
        try {
            const detection = await runVisionModeration(bucket.name, quarantinePath, { detectFace: needFace });
            safe = detection.safe;
            if (!isSafeSearchAllowed(safe)) {
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
            // Must clearly show a human face. For the game this is the whole point
            // (it's a selfie), so escalate repeated non-selfie uploads; elsewhere
            // it's a gentle no-strike reject so users can pick a proper photo.
            if (needFace && !hasHumanFace(detection.faces)) {
                try {
                    await srcFile.delete();
                } catch (_) { /* ignore */ }
                if (isGameSelfie) {
                    const strike = await applyGameSelfieStrike(uid);
                    if (strike.level >= 3) {
                        throw new functions.https.HttpsError(
                            'failed-precondition',
                            'Repeated misuse — you are blocked from this game for 24 hours.',
                            { reason: 'game-blocked', level: 3, blockedUntil: strike.blockedUntil }
                        );
                    }
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        strike.level >= 2
                            ? 'This must be a selfie with a clear face. Final warning — next misuse blocks you from the game for 24 hours.'
                            : 'This must be a selfie with a clear face.',
                        { reason: 'no-face', level: strike.level }
                    );
                }
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Profile photo must clearly show a human face.',
                    { reason: 'no-face' }
                );
            }
            // A valid game selfie forgives any prior non-selfie strikes.
            if (isGameSelfie) {
                await clearGameSelfieStrikes(uid);
            }
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            functionsLogger.error('Vision Safe Search failed — blocking upload (fail-secure)', err);
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

    // Reuse the account avatar as the dating photo — only if it contains a human face.
    exports.prepareDatingPhotoFromAvatar = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'moderate_face_photo', { perHour: FACE_UPLOAD_PER_HOUR, perDay: FACE_UPLOAD_PER_DAY, cooldownMs: 3000 });

        const userSnap = await db.collection('users').doc(uid).get();
        const u = userSnap.exists ? userSnap.data() : {};
        const avatarUrl = String(u.photoURL || u.avatarUrl || '').trim();
        if (!avatarUrl) {
            throw new functions.https.HttpsError('failed-precondition', 'You have no profile photo to use.');
        }
        const objectPath = storagePathFromDownloadUrl(avatarUrl);
        if (!objectPath) {
            throw new functions.https.HttpsError('failed-precondition', 'Could not read your current photo — please upload one.');
        }

        const bucket = getBucket();
        const srcFile = bucket.file(objectPath);
        const [exists] = await srcFile.exists();
        if (!exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Your current photo is unavailable — please upload one.');
        }

        let detection;
        try {
            detection = await runVisionModeration(bucket.name, objectPath, { detectFace: true });
        } catch (err) {
            functionsLogger.error('prepareDatingPhotoFromAvatar Vision failed', err?.message || err);
            throw new functions.https.HttpsError('unavailable', 'Photo check is temporarily unavailable. Please try again.', { reason: 'moderation-unavailable' });
        }
        if (!isSafeSearchAllowed(detection.safe)) {
            throw new functions.https.HttpsError('failed-precondition', 'Image violates content policy.', { reason: 'image-rejected' });
        }
        if (!hasHumanFace(detection.faces)) {
            throw new functions.https.HttpsError('failed-precondition', 'Profile photo must clearly show a human face.', { reason: 'no-face' });
        }

        // Copy the approved avatar into the dedicated dating photo path.
        const ts = Date.now();
        const destPath = `dating_photos/${uid}_${ts}.jpg`;
        const destFile = bucket.file(destPath);
        const [srcMeta] = await srcFile.getMetadata();
        const [buffer] = await srcFile.download();
        await destFile.save(buffer, {
            contentType: srcMeta.contentType || 'image/jpeg',
            metadata: {
                metadata: {
                    moderationStatus: 'approved',
                    moderatedAt: new Date().toISOString(),
                    moderatedBy: 'vision-safe-search',
                    moderationPurpose: 'dating_photo',
                    uploadedBy: uid,
                },
            },
        });
        const token = await ensureDownloadToken(destFile);
        const url = buildPublicDownloadUrl(bucket.name, destPath, token);
        return { photoUrl: url };
    });

    const storageBucket =
        process.env.FIREBASE_STORAGE_BUCKET ||
        (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : null) ||
        'dinebuddies.firebasestorage.app';

    // Safety net: delete direct client uploads to moderated public paths that lack approval.
    // Never touch avatars/covers/logos (see STORAGE_GUARD_PREFIXES). Always re-read metadata
    // before delete — onFinalize often races ahead of custom metadata visibility.
    exports.enforceApprovedImageUpload = functions.storage
        .bucket(storageBucket)
        .object()
        .onFinalize(async (object) => {
            const filePath = object.name || '';
            if (!filePath) return null;

            // Hard skip media written only by moderateImage (metadata race used to delete these).
            if (
                filePath.startsWith('avatars/') ||
                filePath.startsWith('covers/') ||
                filePath.startsWith('logos/') ||
                filePath.startsWith('gallery/') ||
                filePath.startsWith('dating_photos/') ||
                filePath.startsWith('profile_photos/')
            ) {
                return null;
            }

            const isPublicImagePath = STORAGE_GUARD_PREFIXES.some((prefix) => filePath.startsWith(prefix));
            if (!isPublicImagePath) return null;

            const contentType = object.contentType || '';
            if (!contentType.startsWith('image/')) return null;

            if (isModerationApproved(object.metadata)) return null;

            const bucket = getBucket();
            const file = bucket.file(filePath);

            // Fail-secure: retry metadata read, then delete if still unapproved / unreadable.
            let approved = false;
            let missing = false;
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    await sleep(attempt === 0 ? 2000 : 1500);
                    const [meta] = await file.getMetadata();
                    if (isModerationApproved(meta.metadata)) {
                        approved = true;
                        break;
                    }
                } catch (err) {
                    if (err?.code === 404) {
                        missing = true;
                        break;
                    }
                    functionsLogger.warn('Could not re-read image metadata before guard', {
                        filePath,
                        attempt,
                        message: err?.message,
                    });
                }
            }
            if (missing || approved) return null;

            functionsLogger.warn('Removing unmoderated public image upload', { filePath });
            try {
                await file.delete();
            } catch (err) {
                if (err.code !== 404) {
                    functionsLogger.error('Failed to delete unmoderated image', err);
                }
            }
            return null;
        });
}

module.exports = { registerImageModeration, isSafeSearchAllowed };
