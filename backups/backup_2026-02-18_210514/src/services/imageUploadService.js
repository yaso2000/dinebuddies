import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads an image file to Firebase Storage and returns the download URL.
 * @param {File} file - The image file to upload.
 * @param {string} path - The folder path in storage (default: 'uploads').
 * @returns {Promise<string|null>} - The download URL or null if failed/no file.
 */
export const uploadImage = async (file, path = 'uploads') => {
    if (!file) return null;

    try {
        // Create a unique filename to prevent overwrites
        const fileExtension = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const finalPath = `${path}/${fileName}`;

        const storageRef = ref(storage, finalPath);

        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log(`Image uploaded successfully to ${finalPath}`);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};
