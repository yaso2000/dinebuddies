import { storage } from '../firebase/config';
import { storage } from '../firebase/config';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import {
    beginImageUploadSession,
    finishImageUploadSession,
    updateImageUploadSession,
} from './imageUploadProgressStore';

/**
 * Uploads an image file to Firebase Storage and returns the download URL.
 * @param {File} file - The image file to upload.
 * @param {string} path - The folder path in storage (default: 'uploads').
 * @returns {Promise<string|null>} - The download URL or null if failed/no file.
 */
export const uploadImage = async (file, path = 'uploads') => {
    if (!file) return null;

    beginImageUploadSession('uploading');
    try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const finalPath = `${path}/${fileName}`;
        const storageRef = ref(storage, finalPath);

        return await new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const raw = snapshot.totalBytes
                        ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                        : 0;
                    updateImageUploadSession(10 + raw * 0.9, 'uploading');
                },
                reject,
                async () => {
                    try {
                        updateImageUploadSession(100, 'done');
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    } finally {
        finishImageUploadSession();
    }
};
