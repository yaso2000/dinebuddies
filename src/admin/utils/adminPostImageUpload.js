import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';
import { compressImage, validateImageFile } from '../../utils/imageUpload';

/**
 * Admin-only upload for demo post media (no Vision moderation).
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

    const compressed = await compressImage(file, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1600,
        initialQuality: 0.85,
    });

    const ext =
        compressed.type?.includes('webp') ? 'webp' : compressed.type?.includes('png') ? 'png' : 'jpg';
    const path = `admin-posts/uploads/${adminUid}/post_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    const contentType =
        compressed.type && compressed.type.startsWith('image/') ? compressed.type : 'image/jpeg';

    return new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, compressed, { contentType });
        task.on(
            'state_changed',
            (snapshot) => {
                if (!onProgress || !snapshot.totalBytes) return;
                onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            },
            reject,
            async () => {
                try {
                    resolve(await getDownloadURL(task.snapshot.ref));
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}
