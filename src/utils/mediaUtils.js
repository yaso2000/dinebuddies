import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

/**
 * Compress and upload image to Firebase Storage
 * @param {File} file - Image file
 * @param {string} userId - User ID for path
 * @returns {Promise<string>} - Download URL
 */
export const uploadImage = async (file, userId) => {
    try {
        // Compression options
        const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            fileType: 'image/jpeg'
        };

        // Compress image
        const compressedFile = await imageCompression(file, options);

        // Create storage reference
        const timestamp = Date.now();
        const fileName = `${userId}_${timestamp}.jpg`;
        const storageRef = ref(storage, `chat_images/${userId}/${fileName}`);

        // Upload
        await uploadBytes(storageRef, compressedFile);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
};

/**
 * Upload voice message to Firebase Storage
 * @param {Blob} audioBlob - Audio blob
 * @param {string} userId - User ID for path
 * @returns {Promise<string>} - Download URL
 */
export const uploadVoiceMessage = async (audioBlob, userId) => {
    try {
        const timestamp = Date.now();
        const fileName = `${userId}_${timestamp}.webm`;
        const storageRef = ref(storage, `voice_messages/${userId}/${fileName}`);

        await uploadBytes(storageRef, audioBlob);
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading voice message:', error);
        throw error;
    }
};

/**
 * Upload file attachment to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} userId - User ID for path
 * @returns {Promise<{url: string, name: string, size: number}>}
 */
export const uploadFile = async (file, userId) => {
    try {
        const timestamp = Date.now();
        const fileName = `${userId}_${timestamp}_${file.name}`;
        const storageRef = ref(storage, `chat_files/${userId}/${fileName}`);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        return {
            url: downloadURL,
            name: file.name,
            size: file.size
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

/**
 * Record audio using MediaRecorder API
 * @param {number} maxDuration - Max duration in seconds (default: 60)
 * @returns {Promise<Blob>} - Audio blob
 */
export const recordAudio = (maxDuration = 60) => {
    return new Promise((resolve, reject) => {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const mediaRecorder = new MediaRecorder(stream);
                const audioChunks = [];

                mediaRecorder.addEventListener('dataavailable', event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener('stop', () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    stream.getTracks().forEach(track => track.stop());
                    resolve(audioBlob);
                });

                mediaRecorder.addEventListener('error', error => {
                    stream.getTracks().forEach(track => track.stop());
                    reject(error);
                });

                mediaRecorder.start();

                // Auto-stop after maxDuration
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, maxDuration * 1000);

                // Return control object
                return {
                    stop: () => mediaRecorder.stop(),
                    state: () => mediaRecorder.state
                };
            })
            .catch(reject);
    });
};

/**
 * Format file size to human readable
 * @param {number} bytes 
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format audio duration
 * @param {number} seconds 
 * @returns {string}
 */
export const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
