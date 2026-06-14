import imageCompression from 'browser-image-compression';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { uploadImageWithModeration } from './moderatedImageUpload';
import { ImageUploadZone, isPrivateDmZone } from './imageUploadZones';
import {
    beginImageUploadSession,
    finishImageUploadSession,
    updateImageUploadSession,
} from './imageUploadProgressStore';

const DEFAULT_COMPRESS = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg',
};

async function compressForUpload(file, compressionOptions = {}) {
    try {
        return await imageCompression(file, { ...DEFAULT_COMPRESS, ...compressionOptions });
    } catch {
        return file;
    }
}

function mergeProgressCallbacks(opts = {}) {
    const { onProgress } = opts;
    return (pct, phase) => {
        updateImageUploadSession(pct, phase);
        if (onProgress) onProgress(pct);
    };
}

/**
 * Direct upload for private 1:1 DM only (no moderation).
 */
async function uploadPrivateDmImage(file, userId, onProgress = null) {
    const report = (pct) => {
        updateImageUploadSession(pct, 'uploading');
        if (onProgress) onProgress(pct);
    };

    report(8);
    const compressed = await compressForUpload(file);
    report(15);

    const timestamp = Date.now();
    const fileName = `${userId}_${timestamp}.jpg`;
    const storageRef = ref(storage, `chat_images/${userId}/${fileName}`);

    return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, compressed, { contentType: 'image/jpeg' });
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const raw = snapshot.totalBytes
                    ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    : 0;
                report(15 + raw * 0.85);
            },
            reject,
            async () => {
                try {
                    report(100);
                    resolve(await getDownloadURL(uploadTask.snapshot.ref));
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

/**
 * @param {File|Blob} file
 * @param {string} userId
 * @param {string} zone — ImageUploadZone value (except private_dm uses Vision purpose id)
 * @param {{ compressionOptions?: object, onProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<string>}
 */
export async function uploadManagedImage(file, userId, zone, opts = {}) {
    if (!userId) throw new Error('User ID required');

    beginImageUploadSession('preparing');
    const report = mergeProgressCallbacks(opts);

    try {
        if (isPrivateDmZone(zone)) {
            return await uploadPrivateDmImage(file, userId, (pct) => report(pct, 'uploading'));
        }

        report(5, 'preparing');
        const compressed = await compressForUpload(file, opts.compressionOptions);
        report(10, 'uploading');
        return await uploadImageWithModeration(compressed, userId, zone, {
            onProgress: (pct) => report(pct, pct >= 38 ? 'checking' : 'uploading'),
        });
    } finally {
        finishImageUploadSession();
    }
}
