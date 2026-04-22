import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import imageCompression from 'browser-image-compression';

/**
 * Compress and resize image before upload
 * @param {File} file - Image file to compress
 * @param {Object} options - Compression options (maxSizeMB, maxWidthOrHeight, etc.)
 * @returns {Promise<Blob>} Compressed image blob
 */
export const compressImage = async (file, options = {}) => {
    const defaultOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: file.type || 'image/jpeg',
        initialQuality: 0.8
    };

    const compressionOptions = { ...defaultOptions, ...options };

    try {
        const compressedFile = await imageCompression(file, compressionOptions);
        return compressedFile;
    } catch (error) {
        console.error('Error compressing image:', error);
        throw error;
    }
};

/**
 * Upload image to Firebase Storage
 * @param {File|Blob} file - Image file to upload
 * @param {string} path - Storage path (e.g., 'avatars/userId.jpg')
 * @param {Function} onProgress - Progress callback (percentage)
 * @param {Object} compressionOptions - Options for image compression
 * @returns {Promise<string>} Download URL
 */
const MAX_IMAGE_MB = 15;
const COMPRESSION_TIMEOUT_MS = 12000;
const UPLOAD_TIMEOUT_MS = 45000;
const COMPRESSION_SKIP_THRESHOLD_BYTES = 700 * 1024; // Skip compression for small images

export const uploadImage = (file, path, onProgress = null, compressionOptions = {}) => {
    return new Promise(async (resolve, reject) => {
        let uploadTimedOut = false;
        let uploadTimeoutId = null;
        try {
            const sizeMB = file.size / (1024 * 1024);
            if (sizeMB > MAX_IMAGE_MB) {
                reject(new Error(`Image must be under ${MAX_IMAGE_MB}MB (current: ${sizeMB.toFixed(1)}MB)`));
                return;
            }
            // Compress image before upload
            let uploadFile = file;
            if (file.type.startsWith('image/') && file.size > COMPRESSION_SKIP_THRESHOLD_BYTES) {
                try {
                    const compressionTask = compressImage(file, compressionOptions);
                    const timeoutTask = new Promise((_, rej) =>
                        setTimeout(() => rej(new Error('Image compression timeout')), COMPRESSION_TIMEOUT_MS)
                    );
                    uploadFile = await Promise.race([compressionTask, timeoutTask]);
                } catch (compressionError) {
                    console.warn('Compression skipped, uploading original file:', compressionError?.message || compressionError);
                    uploadFile = file;
                }
            }

            const storageRef = ref(storage, path);
            const contentType = (uploadFile.type && uploadFile.type.startsWith('image/')) ? uploadFile.type : 'image/jpeg';
            const uploadTask = uploadBytesResumable(storageRef, uploadFile, { contentType });
            uploadTimeoutId = setTimeout(() => {
                uploadTimedOut = true;
                try {
                    uploadTask.cancel();
                } catch {
                    // ignore cancel errors
                }
                reject(new Error('Upload timeout. Please try a smaller image or check your connection.'));
            }, UPLOAD_TIMEOUT_MS);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    if (uploadTimedOut) return;
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) {
                        onProgress(progress);
                    }
                },
                (error) => {
                    if (uploadTimeoutId) clearTimeout(uploadTimeoutId);
                    if (uploadTimedOut) return;
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    if (uploadTimeoutId) clearTimeout(uploadTimeoutId);
                    if (uploadTimedOut) return;
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Upload profile picture
 * @param {File} file - Image file
 * @param {string} userId - User ID
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} Download URL
 */
export const uploadProfilePicture = async (file, userId, onProgress = null) => {
    const timestamp = Date.now();
    const path = `avatars/${userId}_${timestamp}.jpg`;
    return uploadImage(file, path, onProgress);
};

/**
 * Upload invitation photo
 * @param {File} file - Image file
 * @param {string} invitationId - Invitation ID
 * @param {string} userId - Uploader's UID (used to enforce storage ownership)
 * @param {number} index - Photo index
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} Download URL
 */
export const uploadInvitationPhoto = async (file, invitationId, userId, index = 0, onProgress = null) => {
    const timestamp = Date.now();
    // uid subfolder enforces ownership via storage.rules (request.auth.uid == userId)
    const path = `invitations/${invitationId}/${userId}/${timestamp}_${index}.jpg`;
    return uploadImage(file, path, onProgress);
};

/**
 * Delete image from Firebase Storage
 * @param {string} imageUrl - Full download URL of the image
 * @returns {Promise<void>}
 */
export const deleteImage = async (imageUrl) => {
    try {
        // Extract path from URL
        const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
        if (!imageUrl.startsWith(baseUrl)) {
            throw new Error('Invalid Firebase Storage URL');
        }

        const imagePath = imageUrl.split('/o/')[1].split('?')[0];
        const decodedPath = decodeURIComponent(imagePath);

        const imageRef = ref(storage, decodedPath);
        await deleteObject(imageRef);
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
};

/**
 * Validate image file
 * @param {File} file - File to validate
 * @param {number} maxSize - Max size in MB (default: 5)
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateImageFile = (file, maxSize = 5) => {
    // Check if file exists
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Only JPG, PNG, and WebP images are allowed' };
    }

    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return { valid: false, error: `Image size must be less than ${maxSize}MB` };
    }

    return { valid: true, error: null };
};
