import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { generateThumbnail } from '../utils/thumbnailGenerator';

/**
 * Upload media file (image or video) to Firebase Storage
 * @param {File} file - Media file to upload
 * @param {string} userId - User ID
 * @param {string} type - Type: 'image' | 'video' | 'thumbnail'
 * @param {string} folder - Folder name (e.g., 'invitations', 'posts', 'stories')
 * @returns {Promise<string>} - Download URL
 */
export const uploadMedia = async (file, userId, type, folder = 'invitations') => {
    try {
        // Determin extension
        let extension = type === 'video' ? 'webm' : 'jpg';
        if (file.name) {
            const parts = file.name.split('.');
            if (parts.length > 1) {
                extension = parts.pop().toLowerCase();
            }
        } else if (file.type) {
            const ext = file.type.split('/')[1];
            if (ext) extension = ext.split(';')[0]; // handle 'webm;codecs=...'
        }

        const timestamp = Date.now();
        const path = `${folder}/${userId}/${timestamp}_${type}.${extension}`;

        const storageRef = ref(storage, path);

        // Use resumable upload for better reliability
        const { uploadBytesResumable } = await import('firebase/storage');
        const uploadTask = uploadBytesResumable(storageRef, file);

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
 * Upload Google/External image via Proxy
 * @param {string} url - External URL
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Firebase Storage URL
 */
export const uploadGoogleImage = async (url, userId) => {
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
        const uploadedUrl = await uploadMedia(file, userId, 'image', 'invitations');
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
