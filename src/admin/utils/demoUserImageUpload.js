import { validateImageFile } from '../../utils/imageUpload';
import { uploadManagedImage } from '../../services/managedImageUpload';
import { ImageUploadZone } from '../../services/imageUploadZones';

const ZONE_BY_KIND = {
    avatar: ImageUploadZone.AVATAR,
    cover: ImageUploadZone.COVER,
    gallery: ImageUploadZone.GALLERY,
};

/**
 * Admin demo user profile media — same Vision pipeline as consumer uploads.
 * @param {File} file
 * @param {string} adminUid
 * @param {'avatar'|'cover'|'gallery'} kind
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<string>}
 */
export async function uploadDemoUserAdminImage(file, adminUid, kind, onProgress) {
    const validation = validateImageFile(file, 8);
    if (!validation.valid) {
        throw new Error(validation.error);
    }
    if (!adminUid) {
        throw new Error('Admin sign-in required to upload images.');
    }
    const zone = ZONE_BY_KIND[kind];
    if (!zone) {
        throw new Error(`Unsupported demo image kind: ${kind}`);
    }

    return uploadManagedImage(file, adminUid, zone, {
        onProgress,
        compressionOptions: {
            maxSizeMB: kind === 'cover' ? 1.2 : 0.9,
            maxWidthOrHeight: kind === 'cover' ? 1920 : 1200,
            initialQuality: 0.85,
        },
    });
}
