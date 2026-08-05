import { validateImageFile } from '../../utils/imageUpload';
import { uploadManagedImage } from '../../services/managedImageUpload';
import { ImageUploadZone } from '../../services/imageUploadZones';

/**
 * Admin demo post media — Vision-moderated (same pipeline as community posts).
 * @param {File} file
 * @param {string} adminUid
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<string>}
 */
export async function uploadAdminPostImage(file, adminUid, onProgress) {
    const validation = validateImageFile(file, 8);
    if (!validation.valid) {
        throw new Error(validation.error);
    }
    if (!adminUid) {
        throw new Error('Admin sign-in required to upload images.');
    }

    return uploadManagedImage(file, adminUid, ImageUploadZone.POST, {
        onProgress,
        compressionOptions: {
            maxSizeMB: 1.2,
            maxWidthOrHeight: 1600,
            initialQuality: 0.85,
        },
    });
}
