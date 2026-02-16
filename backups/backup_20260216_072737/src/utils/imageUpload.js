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
export const uploadImage = (file, path, onProgress = null, compressionOptions = {}) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Compress image before upload
            let uploadFile = file;
            if (file.type.startsWith('image/')) {
                uploadFile = await compressImage(file, compressionOptions);
            }

            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, uploadFile);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) {
                        onProgress(progress);
                    }
                },
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
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
 * @param {number} index - Photo index
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} Download URL
 */
export const uploadInvitationPhoto = async (file, invitationId, index = 0, onProgress = null) => {
    const timestamp = Date.now();
    const path = `invitations/${invitationId}/${timestamp}_${index}.jpg`;
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
