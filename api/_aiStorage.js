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

/** @returns {string[]} unique bucket names to try, in order (primary first). */
export function bucketCandidates() {
    const names = [];
    const primary = resolveStorageBucketName();
    if (primary) {
        names.push(primary);
    }

    try {
        const { projectId } = getFirebaseAdminCertConfig();
        if (projectId) {
            const modern = `${projectId}.firebasestorage.app`;
            const legacy = `${projectId}.appspot.com`;
            if (!names.includes(modern)) names.push(modern);
            if (!names.includes(legacy)) names.push(legacy);
        }
    } catch {
        /* no project id */
    }

    names.push('');
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

/**
 * Ensure firebaseStorageDownloadTokens is present on the uploaded object.
 * @param {import('firebase-admin/storage').File} fileRef
 * @param {string} [seedToken]
 */
async function ensureDownloadToken(fileRef, seedToken) {
    const [meta] = await fileRef.getMetadata();
    const custom = meta?.metadata || {};
    const existing = custom.firebaseStorageDownloadTokens;
    if (typeof existing === 'string' && existing.trim()) {
        return existing.trim();
    }
    const token = seedToken || randomUUID();
    await fileRef.setMetadata({
        metadata: {
            ...custom,
            firebaseStorageDownloadTokens: token,
            source: custom.source || 'ai_generated',
        },
    });
    return token;
}

/**
 * @param {import('firebase-admin/storage').Bucket} bucket
 * @param {string} objectPath
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} token
 * @param {string} [sourceTag]
 */
async function saveToBucket(bucket, objectPath, buffer, mimeType, token, sourceTag = 'public_upload') {
    const fileRef = bucket.file(objectPath);
    await fileRef.save(buffer, {
        contentType: mimeType,
        resumable: false,
        metadata: {
            cacheControl: 'public, max-age=31536000',
            metadata: {
                firebaseStorageDownloadTokens: token,
                source: String(sourceTag || 'public_upload'),
            },
        },
    });
    await ensureDownloadToken(fileRef, token);
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

/** Ten-year v4 signed read URL — works without Firebase download tokens. */
async function buildLongLivedSignedReadUrl(fileRef) {
    const [signedUrl] = await fileRef.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return signedUrl;
}

/**
 * Resolve a browser-usable public download URL for the bucket where the object was saved.
 * Never maps appspot.com ↔ firebasestorage.app — they are separate buckets on modern projects.
 *
 * @param {import('firebase-admin/storage').File} fileRef
 * @param {import('firebase-admin/storage').Bucket} bucket
 * @param {string} objectPath
 * @param {string} token
 * @returns {Promise<string>}
 */
async function resolvePublicDownloadUrl(fileRef, bucket, objectPath, token) {
    const bucketName = bucket.name;
    const effectiveToken = await ensureDownloadToken(fileRef, token);
    const tokenUrl = buildTokenDownloadUrl(bucketName, objectPath, effectiveToken);

    // Signed URLs are the most reliable cross-environment read path for Admin uploads.
    try {
        const signedUrl = await buildLongLivedSignedReadUrl(fileRef);
        if (await probeDownloadUrl(signedUrl)) {
            return signedUrl;
        }
        console.info(
            '[resolvePublicDownloadUrl] using signed URL',
            `bucket=${bucketName}`,
            `path=${objectPath}`,
        );
        return signedUrl;
    } catch (err) {
        console.warn(
            '[resolvePublicDownloadUrl] signed_url_failed',
            err instanceof Error ? err.message : err,
            `bucket=${bucketName}`,
            `path=${objectPath}`,
        );
    }

    if (await probeDownloadUrl(tokenUrl)) {
        return tokenUrl;
    }

    for (const delayMs of [400, 800, 1600]) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (await probeDownloadUrl(tokenUrl)) {
            return tokenUrl;
        }
    }

    console.warn(
        '[resolvePublicDownloadUrl] using token URL after admin-verified upload',
        `bucket=${bucketName}`,
        `path=${objectPath}`,
    );
    return tokenUrl;
}

/**
 * Confirm a storage object is readable (Admin SDK — any configured bucket).
 * @param {string} objectPath
 */
export async function verifyStorageObjectReadable(objectPath) {
    const path = String(objectPath || '').trim();
    if (!path) return false;
    try {
        const { buffer } = await downloadStorageObjectBuffer(path);
        return Boolean(buffer?.length >= 500);
    } catch {
        return false;
    }
}

/**
 * Download a storage object via Admin SDK (tries preferred bucket, then configured buckets).
 * @param {string} objectPath
 * @param {{ preferredBucket?: string }} [opts]
 * @returns {Promise<{ buffer: Buffer, contentType: string, bucketName: string }>}
 */
export async function downloadStorageObjectBuffer(objectPath, opts = {}) {
    ensureFirebaseAdmin();
    const storage = getStorage();
    let lastError = null;

    const names = [];
    const preferred = String(opts.preferredBucket || '').trim();
    if (preferred) names.push(preferred);
    for (const name of bucketCandidates()) {
        if (name && !names.includes(name)) names.push(name);
    }
    if (!names.includes('')) names.push('');

    for (const name of names) {
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
            await saveToBucket(bucket, objectPath, buffer, mimeType, token, 'ai_generated');
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

    const readable = await downloadStorageObjectBuffer(objectPath, {
        preferredBucket: usedBucket.name,
    }).catch(() => null);
    if (!readable?.buffer?.length) {
        throw new Error(
            `storage_upload_not_readable: bucket=${usedBucket.name} path=${objectPath}`,
        );
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
 * Upload raw image bytes to a public-read Storage path (verified + token URL).
 * @param {string} objectPath
 * @param {Buffer} buffer
 * @param {string} [mimeType]
 * @param {string} [sourceTag]
 */
export async function uploadPublicStorageBuffer(
    objectPath,
    buffer,
    mimeType = 'image/jpeg',
    sourceTag = 'public_upload',
) {
    ensureFirebaseAdmin();
    const storage = getStorage();
    const token = randomUUID();

    if (!buffer?.length || buffer.length < 500) {
        throw new Error(`storage_upload_invalid_buffer: ${buffer?.length || 0} bytes`);
    }

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
            await saveToBucket(bucket, objectPath, buffer, mimeType, token, sourceTag);
            await verifyUploadedObject(fileRef, buffer.length);
            usedBucket = bucket;
            usedFileRef = fileRef;
            break;
        } catch (err) {
            lastError = err;
            try {
                await fileRef.delete({ ignoreNotFound: true });
            } catch {
                /* ignore */
            }
        }
    }

    if (!usedBucket || !usedFileRef) {
        throw lastError instanceof Error
            ? lastError
            : new Error(lastError ? String(lastError) : 'storage_upload_failed');
    }

    const url = await resolvePublicDownloadUrl(usedFileRef, usedBucket, objectPath, token);
    return { url, path: objectPath, bucket: usedBucket.name, mimeType, downloadUrl: url };
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
