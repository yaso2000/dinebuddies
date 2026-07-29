import imageCompression from 'browser-image-compression';
import { uploadImageWithModeration } from './moderatedImageUpload';
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
 * Compress + Vision-moderate every image upload (including 1:1 DMs and profile media).
 * @param {File|Blob} file
 * @param {string} userId
 * @param {string} zone — ImageUploadZone value
 * @param {{ compressionOptions?: object, onProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<string>}
 */
export async function uploadManagedImage(file, userId, zone, opts = {}) {
    if (!userId) throw new Error('User ID required');
    if (!zone) throw new Error('Upload zone required');

    beginImageUploadSession('preparing');
    const report = mergeProgressCallbacks(opts);

    try {
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
