import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { uploadImageWithModeration } from './moderatedImageUpload';
import { ImageUploadZone, isPrivateDmZone } from './imageUploadZones';

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

/**
 * Direct upload for private 1:1 DM only (no moderation).
 */
async function uploadPrivateDmImage(file, userId) {
    const compressed = await compressForUpload(file);
    const timestamp = Date.now();
    const fileName = `${userId}_${timestamp}.jpg`;
    const storageRef = ref(storage, `chat_images/${userId}/${fileName}`);
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
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
    if (isPrivateDmZone(zone)) {
        return uploadPrivateDmImage(file, userId);
    }
    const compressed = await compressForUpload(file, opts.compressionOptions);
    return uploadImageWithModeration(compressed, userId, zone, { onProgress: opts.onProgress });
}
