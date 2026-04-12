import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { generateThumbnail } from '../utils/thumbnailGenerator';
import { compressImage } from '../utils/imageUpload';

/**
 * Upload media file (image or video) to Firebase Storage
 * @param {File} file - Media file to upload
 * @param {string} userId - User ID
 * @param {string} type - Type: 'image' | 'video' | 'thumbnail'
 * @param {string} folder - Folder name (e.g., 'invitations', 'posts', 'stories')
 * @returns {Promise<string>} - Download URL
 */
const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 100;

export const uploadMedia = async (file, userId, type, folder = 'invitations') => {
    try {
        const sizeMB = file.size / (1024 * 1024);
        if (type === 'video' && sizeMB > MAX_VIDEO_MB) {
            throw new Error(`Video must be under ${MAX_VIDEO_MB}MB (current: ${sizeMB.toFixed(1)}MB)`);
        }
        if (type === 'image' && sizeMB > MAX_IMAGE_MB) {
            throw new Error(`Image must be under ${MAX_IMAGE_MB}MB (current: ${sizeMB.toFixed(1)}MB)`);
        }
        // Compress images and thumbnails on the client before upload (saves storage and speeds up uploads)
        let fileToUpload = file;
        if ((type === 'image' || type === 'thumbnail') && file.type?.startsWith('image/')) {
            try {
                fileToUpload = await compressImage(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 });
            } catch (e) {
                console.warn('Image compression failed, uploading original:', e?.message);
            }
        }
        // Determin extension
        let extension = type === 'video' ? 'webm' : 'jpg';
        if (fileToUpload.name) {
            const parts = fileToUpload.name.split('.');
            if (parts.length > 1) {
                extension = parts.pop().toLowerCase();
            }
        } else if (fileToUpload.type) {
            const ext = fileToUpload.type.split('/')[1];
            if (ext) extension = ext.split(';')[0]; // handle 'webm;codecs=...'
        }

        const timestamp = Date.now();
        const path = `${folder}/${userId}/${timestamp}_${type}.${extension}`;

        const storageRef = ref(storage, path);

        // Use resumable upload for better reliability
        const { uploadBytesResumable } = await import('firebase/storage');
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Observe state change events such as progress, pause, and resume
                },
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    // Handle successful uploads on complete
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error uploading media:', error);
        throw new Error('Failed to upload media');
    }
};

/**
 * Upload video with thumbnail
 * @param {File} videoFile - Video file
 * @param {string} userId - User ID
 * @param {string} folder - Folder name
 * @returns {Promise<{videoUrl: string, thumbnailUrl: string}>}
 */
export const uploadVideoWithThumbnail = async (videoFile, userId, folder = 'invitations') => {
    try {
        console.log('📹 Starting video upload...');

        // Upload video first
        const videoUrl = await uploadMedia(videoFile, userId, 'video', folder);
        console.log('✅ Video uploaded:', videoUrl);

        let thumbnailUrl = null;

        // Try to generate and upload thumbnail
        try {
            console.log('🖼️ Generating thumbnail...');
            const thumbnailBlob = await generateThumbnail(videoFile, 0.5);
            console.log('✅ Thumbnail generated:', thumbnailBlob.size, 'bytes');

            const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
            thumbnailUrl = await uploadMedia(thumbnailFile, userId, 'thumbnail', folder);
            console.log('✅ Thumbnail uploaded:', thumbnailUrl);
        } catch (thumbError) {
            console.warn('⚠️ Thumbnail generation failed, using default:', thumbError);
            // Use a default thumbnail or the video URL itself
            thumbnailUrl = videoUrl; // Browser will show first frame
        }

        return {
            videoUrl,
            thumbnailUrl
        };
    } catch (error) {
        console.error('❌ Error uploading video with thumbnail:', error);
        throw error;
    }
};

/**
 * Upload Place Photo from our server-side API (for Google Business import).
 * Use when placeId is available; avoids PhotoService 403.
 * @param {string} placeId - Google Place ID
 * @param {number} index - Photo index (0 = cover/header)
 * @param {string} userId - User ID
 * @param {string} [folder='businesses'] - Storage folder
 * @returns {Promise<string|null>} - Firebase Storage URL or null
 */
export const uploadPlacePhoto = async (placeId, index, userId, folder = 'businesses') => {
    if (!placeId || !userId) return null;
    const endpoint = import.meta.env.DEV ? '/__dev/place-photo' : '/api/place-photo';
    const apiUrl = `${endpoint}?placeId=${encodeURIComponent(placeId)}&index=${index}`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`Place photo API: ${res.status}`);
        const blob = await res.blob();
        if (blob.size < 500) return null;
        const file = new File([blob], `place_photo_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        return await uploadMedia(file, userId, 'image', folder);
    } catch (e) {
        console.warn('uploadPlacePhoto failed:', e);
        return null;
    }
};

/**
 * Upload a photo from a relative /api/place-photo?placeId=...&index=N URL.
 * Parses placeId + index from the URL, then calls uploadPlacePhoto.
 * Returns Firebase Storage URL on success, null on failure.
 * @param {string} url - Relative or absolute place-photo URL
 * @param {string} userId
 * @param {string} [folder='businesses']
 */
export const uploadPlacePhotoFromUrl = async (url, userId, folder = 'businesses') => {
    if (!url || !userId) return null;
    // Already a Firebase Storage URL — return as-is
    if (url.includes('firebasestorage.googleapis.com')) return url;
    try {
        // Parse placeId and index regardless of whether URL is relative or absolute
        const parsed = new URL(url, 'https://placeholder.local');
        const placeId = parsed.searchParams.get('placeId');
        const index = parseInt(parsed.searchParams.get('index') || '0', 10);
        if (!placeId) return null;
        return await uploadPlacePhoto(placeId, index, userId, folder);
    } catch (e) {
        console.warn('uploadPlacePhotoFromUrl failed:', url, e);
        return null;
    }
};


/**
 * Upload Google/External image via Proxy
 * @param {string} url - External URL
 * @param {string} userId - User ID
 * @param {string} [folder='invitations'] - Storage folder (e.g. 'invitations', 'businesses')
 * @returns {Promise<string>} - Firebase Storage URL
 */
export const uploadGoogleImage = async (url, userId, folder = 'invitations') => {
    // Optimization: if already Firebase URL, just return it
    if (!url) return null;
    if (url.includes('firebasestorage')) {
        return url;
    }

    console.log('🔄 Fetching image via proxy to bypass CORS:', url);

    // In dev: uses vite middleware. In prod: uses Vercel function
    const proxyEndpoint = import.meta.env.DEV ? '/__dev/proxy-image' : '/api/proxy';
    const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`Proxy fetch failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        console.log(`📦 Proxy Blob: Size=${blob.size}, Type=${blob.type}`);

        if (blob.size < 1000) {
            console.warn('⚠️ Blob too small, likely an error page.');
            // Optional: read text to debug, but proceed with caution
            const text = await blob.text();
            console.error('Proxy Response:', text);
        }

        // Generate unique filename
        const filename = `google_place_${Date.now()}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });

        console.log('📤 Uploading proxied image to storage...');
        const uploadedUrl = await uploadMedia(file, userId, 'image', folder);
        console.log('✅ Image permanently stored:', uploadedUrl);

        return uploadedUrl;
    } catch (error) {
        console.error("Failed to upload Google image:", error);
        // Silently fail or track error without intrusive alert
        throw error;
    }
};

/**
 * Get video duration helper
 */
const getVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            resolve(video.duration);
            URL.revokeObjectURL(video.src);
        };

        video.onerror = () => {
            reject(new Error('Failed to load video'));
            URL.revokeObjectURL(video.src);
        };
    });
};

/**
 * Process and upload invitation media based on source
 * @param {Object} mediaData - Media data from MediaSelector
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Processed media data for Firestore
 */
export const processInvitationMedia = async (mediaData, userId) => {
    try {
        if (!mediaData) {
            throw new Error('No media data provided');
        }

        const { source, file, url, type } = mediaData;

        switch (source) {
            case 'restaurant':
                // Use restaurant image as-is
                return {
                    mediaSource: 'restaurant',
                    restaurantImage: url,
                    mediaType: 'image'
                };

            case 'custom_image':
                // Upload custom image if file present, otherwise assume preview is url
                let imageUrl;
                if (file) {
                    imageUrl = await uploadMedia(file, userId, 'image', 'invitations');
                } else {
                    imageUrl = mediaData.preview;
                }
                return {
                    mediaSource: 'custom_image',
                    customImage: imageUrl,
                    mediaType: 'image'
                };

            case 'custom_video':
                let customVideo, videoThumbnail, videoDuration;
                if (file) {
                    const result = await uploadVideoWithThumbnail(file, userId, 'invitations');
                    customVideo = result.videoUrl;
                    videoThumbnail = result.thumbnailUrl;
                    try {
                        videoDuration = Math.round(await getVideoDuration(file));
                    } catch (e) {
                        videoDuration = 0;
                    }
                } else {
                    customVideo = mediaData.preview;
                    videoThumbnail = mediaData.videoThumbnail;
                    videoDuration = mediaData.videoDuration;
                }

                return {
                    mediaSource: 'custom_video',
                    customVideo,
                    videoThumbnail,
                    videoDuration,
                    mediaType: 'video'
                };

            case 'venue':
            case 'google_place':
                let restaurantImage;
                try {
                    // Use the new reusable function
                    restaurantImage = await uploadGoogleImage(url, userId);
                } catch (e) {
                    console.warn("Fallback to original URL due to error:", e);
                    restaurantImage = url;
                }
                return {
                    mediaSource: 'google_place',
                    restaurantImage: restaurantImage,
                    mediaType: 'image'
                };

            default:
                console.warn(`Unknown media source: ${source}, falling back to restaurant image`);
                return {
                    mediaSource: 'restaurant',
                    restaurantImage: url,
                    mediaType: 'image'
                };
        }
    } catch (error) {
        console.error('Error processing invitation media:', error);
        throw error;
    }
};
