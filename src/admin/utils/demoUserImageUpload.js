import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';
import { compressImage, validateImageFile } from '../../utils/imageUpload';

/**
 * Admin-only direct upload for demo user profile media (no Vision moderation).
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

    const maxDim = kind === 'cover' ? 1920 : 1200;
    const compressed = await compressImage(file, {
        maxSizeMB: kind === 'cover' ? 1.2 : 0.9,
        maxWidthOrHeight: maxDim,
        initialQuality: 0.85,
    });

    const ext =
        compressed.type?.includes('webp') ? 'webp' : compressed.type?.includes('png') ? 'png' : 'jpg';
    const path = `demo-users/uploads/${adminUid}/${kind}_${Date.now()}.${ext}`;
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
