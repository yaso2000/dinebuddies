import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

/**
 * Compress and resize image before upload
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width (default: 1200)
 * @param {number} maxHeight - Maximum height (default: 1200)
 * @param {number} quality - Image quality 0-1 (default: 0.8)
 * @returns {Promise<Blob>} Compressed image blob
 */
export const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = height * (maxWidth / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = width * (maxHeight / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas to Blob conversion failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = (error) => {
                reject(error);
            };
        };

        reader.onerror = (error) => {
            reject(error);
        };
    });
};

/**
 * Upload image to Firebase Storage
 * @param {File|Blob} file - Image file to upload
 * @param {string} path - Storage path (e.g., 'avatars/userId.jpg')
 * @param {Function} onProgress - Progress callback (percentage)
 * @returns {Promise<string>} Download URL
 */
export const uploadImage = (file, path, onProgress = null) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Compress image before upload
            let uploadFile = file;
            if (file.type.startsWith('image/')) {
                uploadFile = await compressImage(file);
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
