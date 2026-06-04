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
    try {
        const { projectId } = getFirebaseAdminCertConfig();
        if (projectId) {
            // Legacy default bucket first — often the only bucket that accepts Admin writes.
            names.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
        }
    } catch {
        /* no project id */
    }

    const primary = resolveStorageBucketName();
    if (primary) names.unshift(primary);

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

/** Map GCS bucket id to the hostname used in Firebase download URLs. */
function firebaseDownloadBucketName(bucketName) {
    if (!bucketName) return bucketName;
    if (bucketName.endsWith('.appspot.com')) {
        return bucketName.replace('.appspot.com', '.firebasestorage.app');
    }
    return bucketName;
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
    // Token must be set after save — some runtimes ignore nested metadata on save().
    await fileRef.setMetadata({
        metadata: {
            firebaseStorageDownloadTokens: token,
            source: 'ai_generated',
        },
    });
}

/**
 * Confirm the object exists and is readable via Admin SDK (not just exists()).
 * Retries briefly to tolerate rare GCS propagation lag.
 * @param {import('firebase-admin/storage').File} fileRef
 * @param {number} expectedBytes
 * @param {{ attempts?: number, delayMs?: number }} [opts]
 */
async function verifyUploadedObject(fileRef, expectedBytes, { attempts = 5, delayMs = 400 } = {}) {
    const bucketName = fileRef.bucket?.name || '(unknown-bucket)';
    const objectPath = fileRef.name;
    const minBytes = Math.max(500, Math.floor(expectedBytes * 0.9));

    /** @type {Error | null} */
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const [downloaded] = await fileRef.download();
            const size = downloaded?.length || 0;
            if (size >= minBytes) {
                return downloaded;
            }
            lastError = new Error(
                `storage_verify_failed: bucket=${bucketName} path=${objectPath} downloaded=${size} expected>=${minBytes} (source=${expectedBytes})`,
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            lastError = new Error(
                `storage_verify_failed: bucket=${bucketName} path=${objectPath} download_error=${message}`,
            );
        }

        if (attempt < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }

    throw lastError || new Error(`storage_verify_failed: bucket=${bucketName} path=${objectPath}`);
}

async function resolvePublicDownloadUrl(fileRef, bucket, objectPath, token) {
    const urlBucket = firebaseDownloadBucketName(bucket.name);
    const primaryUrl = buildTokenDownloadUrl(urlBucket, objectPath, token);

    /** Prefer token URL — matches metadata we set on upload; no signBlob IAM needed. */
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

    try {
        const [signedUrl] = await fileRef.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        });
        if (await probeDownloadUrl(signedUrl)) {
            return signedUrl;
        }
    } catch (err) {
        console.warn(
            '[uploadInvitationAiImage] signed_url_failed',
            err instanceof Error ? err.message : err,
        );
    }

    console.warn(
        '[uploadInvitationAiImage] public_probe_failed_using_admin_verified_token_url',
        objectPath,
        bucket.name,
    );
    return primaryUrl;
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
        case 'design_studio':
            return 'ai-design-studio';
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

    if (!bytesBase64 || !String(bytesBase64).trim()) {
        throw new Error('storage_upload_invalid_buffer: empty base64 payload from image generator');
    }
    if (!buffer.length || buffer.length < 500) {
        throw new Error(
            `storage_upload_invalid_buffer: decoded ${buffer.length} bytes from base64 length ${String(bytesBase64).length}`,
        );
    }

    console.info(
        '[uploadInvitationAiImage] payload',
        `bytes=${buffer.length}`,
        `mime=${mimeType}`,
        `path_prefix=${folder}/${uid}/`,
    );

    const candidates = bucketCandidates();
    let lastError = null;
    /** @type {import('firebase-admin/storage').Bucket | null} */
    let usedBucket = null;
    /** @type {import('firebase-admin/storage').File | null} */
    let usedFileRef = null;

    for (const name of candidates) {
        const bucket = name ? storage.bucket(name) : storage.bucket();
        const fileRef = bucket.file(objectPath);
        try {
            await saveToBucket(bucket, objectPath, buffer, mimeType, token);
            await verifyUploadedObject(fileRef, buffer.length);
            usedBucket = bucket;
            usedFileRef = fileRef;
            console.info(
                '[uploadInvitationAiImage] verified',
                objectPath,
                'bucket=',
                bucket.name || '(default)',
            );
            break;
        } catch (err) {
            lastError = err;
            console.warn(
                '[uploadInvitationAiImage] bucket failed',
                name || '(default)',
                err instanceof Error ? err.message : err,
            );
            try {
                await fileRef.delete({ ignoreNotFound: true });
            } catch {
                /* ignore cleanup errors */
            }
        }
    }

    if (!usedBucket || !usedFileRef) {
        throw lastError instanceof Error
            ? lastError
            : new Error(lastError ? String(lastError) : 'storage_upload_failed');
    }

    const url = await resolvePublicDownloadUrl(usedFileRef, usedBucket, objectPath, token);
    const createdAt = new Date().toISOString();

    return {
        url,
        path: objectPath,
        bucket: usedBucket.name,
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
