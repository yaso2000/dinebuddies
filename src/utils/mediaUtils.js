import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { uploadManagedImage } from '../services/managedImageUpload';
import { ImageUploadZone } from '../services/imageUploadZones';

/**
 * Compress and upload image to Firebase Storage.
 * @param {File} file
 * @param {string} userId
 * @param {{ zone?: string }} [options] — zone defaults to PUBLIC_CHAT. All zones are Vision-moderated.
 * @returns {Promise<string>}
 */
export const uploadImage = async (file, userId, options = {}) => {
    const zone = options.zone ?? ImageUploadZone.PUBLIC_CHAT;
    const { onProgress } = options;
    try {
        const compressionOptions = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1024,
            useWebWorker: false,
            fileType: 'image/jpeg',
        };
        const compressedFile = await imageCompression(file, compressionOptions);
        
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${compressedFile.name || 'image.jpg'}`;
        const uniqueFile = new File([compressedFile], uniqueFileName, { type: compressedFile.type });

        return uploadManagedImage(uniqueFile, userId, zone, { onProgress });
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
};

/** Prefer MP4/AAC on Safari/iOS (WebM is often silent or unplayable there). */
export const pickAudioRecorderMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
    ];
    for (const type of candidates) {
        try {
            if (MediaRecorder.isTypeSupported(type)) return type;
        } catch {
            /* ignore */
        }
    }
    return '';
};

const audioExtensionForMime = (mimeType = '') => {
    const type = String(mimeType || '').toLowerCase();
    if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    return 'webm';
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
        const uniqueId = Math.random().toString(36).substring(2, 8);
        const contentType = String(audioBlob?.type || '').trim() || 'audio/webm';
        const ext = audioExtensionForMime(contentType);
        const fileName = `${userId}_${timestamp}_${uniqueId}.${ext}`;
        const storageRef = ref(storage, `voice_messages/${userId}/${fileName}`);

        await uploadBytes(storageRef, audioBlob, { contentType });
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading voice message:', error);
        throw error;
    }
};

const MAX_FILE_MB = 20;

/**
 * Upload file attachment to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} userId - User ID for path
 * @returns {Promise<{url: string, name: string, size: number}>}
 */
export const uploadFile = async (file, userId) => {
    try {
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > MAX_FILE_MB) {
            throw new Error(`File must be under ${MAX_FILE_MB}MB (current: ${sizeMB.toFixed(1)}MB)`);
        }
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substring(2, 8);
        const fileName = `${userId}_${timestamp}_${uniqueId}_${file.name}`;
        const storageRef = ref(storage, `chat_files/${userId}/${fileName}`);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        return {
            url: downloadURL,
            name: file.name,
            size: file.size,
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

/**
 * Start recording audio (MP4/AAC on iPhone/Safari when available).
 * @returns {Promise<{stop: () => Promise<Blob>, mediaRecorder: MediaRecorder, mimeType: string}>}
 */
export const startRecording = () => {
    return new Promise((resolve, reject) => {
        navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        })
            .then(stream => {
                const mimeType = pickAudioRecorderMimeType();
                const mediaRecorder = mimeType
                    ? new MediaRecorder(stream, { mimeType })
                    : new MediaRecorder(stream);
                const resolvedMime =
                    mediaRecorder.mimeType || mimeType || 'audio/webm';
                const audioChunks = [];

                mediaRecorder.addEventListener('dataavailable', event => {
                    if (event.data && event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                });

                const stop = () => {
                    return new Promise(resolveStop => {
                        const finish = () => {
                            const blobType =
                                audioChunks[0]?.type || resolvedMime || 'audio/webm';
                            const audioBlob = new Blob(audioChunks, { type: blobType });
                            stream.getTracks().forEach(track => track.stop());
                            resolveStop(audioBlob);
                        };
                        mediaRecorder.addEventListener('stop', finish, { once: true });
                        try {
                            if (mediaRecorder.state === 'recording') {
                                mediaRecorder.requestData?.();
                            }
                        } catch {
                            /* ignore */
                        }
                        mediaRecorder.stop();
                    });
                };

                // Timeslice helps Safari flush chunks before stop.
                mediaRecorder.start(250);
                resolve({ stop, mediaRecorder, mimeType: resolvedMime });
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

class MediaManager {
    constructor() {
        this.listeners = new Set();
        this.activeId = null;
    }
    play(id) {
        this.activeId = id;
        this.listeners.forEach(fn => fn(id));
    }
    stop(id) {
        if (id == null || this.activeId === id) {
            this.activeId = null;
            this.listeners.forEach(fn => fn(null));
        }
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
}
export const globalMediaManager = new MediaManager();
