import { randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { ensureFirebaseAdmin, getFirebaseAdminCertConfig } from './_firebaseAdmin.js';

/**
 * Resolve the Storage bucket for AI image uploads.
 * Prefer explicit env; otherwise derive from project id.
 */
function resolveStorageBucketName() {
    const explicit = String(
        process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    ).trim();
    if (explicit) {
        return explicit.replace(/^gs:\/\//, '');
    }

    try {
        const { projectId } = getFirebaseAdminCertConfig();
        if (projectId) {
            return `${projectId}.firebasestorage.app`;
        }
    } catch {
        /* fall through */
    }

    return null;
}

/** @returns {string[]} unique bucket names to try, in order */
function bucketCandidates() {
    const names = [];
    const primary = resolveStorageBucketName();
    if (primary) names.push(primary);

    try {
        const { projectId } = getFirebaseAdminCertConfig();
        if (projectId) {
            names.push(`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`);
        }
    } catch {
        /* no project id */
    }

    names.push(''); // Admin SDK default bucket (last resort)

    return [...new Set(names)];
}

async function saveToBucket(bucket, objectPath, buffer, mimeType, token) {
    await bucket.file(objectPath).save(buffer, {
        metadata: {
            contentType: mimeType,
            metadata: {
                firebaseStorageDownloadTokens: token,
                source: 'ai_generated',
            },
        },
    });
}

/** Map AI post type to a Storage folder with public read in storage.rules */
export function resolveAiStorageFolder(postType) {
    switch (String(postType || '').toLowerCase()) {
        case 'regular_post':
            return 'community-posts';
        case 'featured_post':
            return 'featured_posts';
        case 'animated_post':
            return 'business-motion';
        case 'invitation':
        default:
            return 'invitations';
    }
}

/**
 * Upload a base64 AI-generated image to Firebase Storage (public-read folder).
 * Returns a download URL compatible with the client media library (plain URL strings).
 *
 * @param {string} uid
 * @param {string} bytesBase64
 * @param {string} [mimeType]
 * @param {string} [postType] - drives storage folder (invitations, community-posts, …)
 */
export async function uploadInvitationAiImage(uid, bytesBase64, mimeType = 'image/jpeg', postType = 'invitation') {
    ensureFirebaseAdmin();

    const storage = getStorage();
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const folder = resolveAiStorageFolder(postType);
    const objectPath = `${folder}/${uid}/ai_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
    const token = randomUUID();
    const buffer = Buffer.from(bytesBase64, 'base64');

    const candidates = bucketCandidates();
    let lastError = null;
    /** @type {import('firebase-admin/storage').Bucket | null} */
    let usedBucket = null;

    for (const name of candidates) {
        const bucket = name ? storage.bucket(name) : storage.bucket();
        try {
            await saveToBucket(bucket, objectPath, buffer, mimeType, token);
            usedBucket = bucket;
            break;
        } catch (err) {
            lastError = err;
            console.warn(
                '[uploadInvitationAiImage] bucket failed',
                name || '(default)',
                err instanceof Error ? err.message : err,
            );
        }
    }

    if (!usedBucket) {
        throw lastError instanceof Error
            ? lastError
            : new Error(lastError ? String(lastError) : 'storage_upload_failed');
    }

    const encodedPath = encodeURIComponent(objectPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${usedBucket.name}/o/${encodedPath}?alt=media&token=${token}`;
    const createdAt = new Date().toISOString();

    return {
        url,
        path: objectPath,
        mimeType,
        mediaLibraryItem: {
            url,
            source: 'ai_generated',
            createdAt,
        },
    };
}
