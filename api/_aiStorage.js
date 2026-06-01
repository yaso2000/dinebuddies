import { randomUUID } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { ensureFirebaseAdmin, getFirebaseAdminCertConfig, getFirebaseStorageBucketName } from './_firebaseAdmin.js';

/**
 * Resolve the Storage bucket for AI image uploads.
 * Prefer explicit env; otherwise derive from project id.
 */
function resolveStorageBucketName() {
    return getFirebaseStorageBucketName() || null;
}

/** @returns {string[]} unique bucket names to try, in order */
export function bucketCandidates() {
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

    return [...new Set(names.filter((n, i, arr) => n !== '' || i === arr.length - 1))];
}

async function probeDownloadUrl(url) {
    try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) return false;
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer.length >= 500;
    } catch {
        return false;
    }
}

function buildTokenDownloadUrl(bucketName, objectPath, token) {
    const encodedPath = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}

async function saveToBucket(bucket, objectPath, buffer, mimeType, token) {
    const fileRef = bucket.file(objectPath);
    await fileRef.save(buffer, {
        contentType: mimeType,
        resumable: false,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    });
    await fileRef.setMetadata({
        contentType: mimeType,
        metadata: {
            firebaseStorageDownloadTokens: token,
            source: 'ai_generated',
        },
    });
}

async function resolvePublicDownloadUrl(fileRef, bucket, objectPath, token) {
    const primaryUrl = buildTokenDownloadUrl(bucket.name, objectPath, token);
    if (await probeDownloadUrl(primaryUrl)) {
        return primaryUrl;
    }

    const altBucketName = bucket.name.includes('.appspot.com')
        ? bucket.name.replace('.appspot.com', '.firebasestorage.app')
        : bucket.name.replace('.firebasestorage.app', '.appspot.com');
    if (altBucketName !== bucket.name) {
        const altUrl = buildTokenDownloadUrl(altBucketName, objectPath, token);
        if (await probeDownloadUrl(altUrl)) {
            return altUrl;
        }
    }

    const [signedUrl] = await fileRef.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });
    if (await probeDownloadUrl(signedUrl)) {
        return signedUrl;
    }

    throw new Error(`storage_download_url_verify_failed (${objectPath})`);
}

/**
 * Download a storage object via Admin SDK (tries all configured buckets).
 * @param {string} objectPath
 * @returns {Promise<{ buffer: Buffer, contentType: string, bucketName: string }>}
 */
export async function downloadStorageObjectBuffer(objectPath) {
    ensureFirebaseAdmin();
    const storage = getStorage();
    let lastError = null;

    for (const name of bucketCandidates()) {
        const bucket = name ? storage.bucket(name) : storage.bucket();
        const fileRef = bucket.file(objectPath);
        try {
            const [exists] = await fileRef.exists();
            if (!exists) continue;
            const [buffer] = await fileRef.download();
            const [metadata] = await fileRef.getMetadata();
            return {
                buffer,
                contentType: metadata.contentType || 'image/jpeg',
                bucketName: bucket.name,
            };
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(lastError ? String(lastError) : 'storage_object_not_found');
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

    const fileRef = usedBucket.file(objectPath);
    const [exists] = await fileRef.exists();
    if (!exists) {
        throw new Error(`storage_verify_failed: object missing after upload (${objectPath})`);
    }

    const url = await resolvePublicDownloadUrl(fileRef, usedBucket, objectPath, token);
    const createdAt = new Date().toISOString();

    return {
        url,
        path: objectPath,
        mimeType,
        mediaLibraryItem: {
            url,
            source: 'ai_generated',
            createdAt,
            path: objectPath,
            mimeType,
        },
    };
}

/**
 * Persist AI-generated media metadata to the user's invitation media library (server-side).
 * @param {string} uid
 * @param {{ url: string, path?: string, mimeType?: string, source?: string, createdAt?: string }} item
 */
export async function persistUserMediaLibraryItem(uid, item) {
    if (!uid || !item?.url) return null;
    ensureFirebaseAdmin();
    const db = getFirestore();
    const docRef = db.collection('users').doc(uid).collection('invitation_media_library').doc();
    const payload = {
        url: String(item.url),
        source: item.source || 'ai_generated',
        path: item.path ? String(item.path) : null,
        mimeType: item.mimeType ? String(item.mimeType) : null,
        createdAt: FieldValue.serverTimestamp(),
        clientCreatedAt: item.createdAt || new Date().toISOString(),
    };
    await docRef.set(payload);
    return { id: docRef.id, ...payload };
}
