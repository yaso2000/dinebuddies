import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebase/config';
import { generateThumbnail } from '../utils/thumbnailGenerator';
import { compressImage } from '../utils/imageUpload';
import { uploadImageWithModeration } from './moderatedImageUpload';
import { folderToImageZone } from './imageUploadZones';
import {
    decodeFirebaseStorageObjectPath,
    isRestrictedFirebaseStorageUrl,
    isServerPersistedAiCoverUrl,
} from '../utils/aiGeneratedMediaUrl';

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

        if (type === 'image' || type === 'thumbnail') {
            const purpose = folderToImageZone(folder, type);
            return uploadImageWithModeration(fileToUpload, userId, purpose);
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
    void placeId;
    void index;
    void userId;
    void folder;
    // Emergency kill-switch: Google Place photos are disabled.
    return null;
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
    void url;
    void userId;
    void folder;
    return null;
};


/**
 * Upload Google/External image via Proxy
 * @param {string} url - External URL
 * @param {string} userId - User ID
 * @param {string} [folder='invitations'] - Storage folder (e.g. 'invitations', 'businesses')
 * @returns {Promise<string>} - Firebase Storage URL
 */
export const uploadGoogleImage = async (url, userId, folder = 'invitations') => {
    if (!url) return null;
    if (url.includes('firebasestorage') && !isRestrictedFirebaseStorageUrl(url)) {
        return url;
    }
    // Block Google Place photo URLs completely (cost-control emergency mode).
    if (
        url.includes('/api/place-photo') ||
        url.includes('/__dev/place-photo') ||
        url.includes('maps.googleapis.com/maps/api/place/photo')
    ) {
        return null;
    }

    try {
        const blob = await fetchRemoteImageBlob(url);
        const filename = `google_place_${Date.now()}.jpg`;
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        console.log('📤 Uploading proxied image to storage...');
        const uploadedUrl = await uploadMedia(file, userId, 'image', folder);
        console.log('✅ Image permanently stored:', uploadedUrl);
        return uploadedUrl;
    } catch (error) {
        console.error('Failed to upload Google image:', error);
        throw error;
    }
};

/**
 * Fetch a remote image through the app proxy (or directly if already on public Storage).
 * @param {string} url
 * @returns {Promise<Blob>}
 */
export async function fetchRemoteImageBlob(url, { attempts = 3 } = {}) {
    if (!url || typeof url !== 'string') {
        throw new Error('No image URL');
    }

    const tryFetch = async (targetUrl) => {
        const response = await fetch(targetUrl);
        if (!response.ok) {
            return { ok: false, status: response.status };
        }
        const blob = await response.blob();
        if (blob.size < 500) {
            return { ok: false, status: 0, error: new Error('Image payload too small') };
        }
        return { ok: true, blob };
    };

    if (url.includes('firebasestorage') && !isRestrictedFirebaseStorageUrl(url)) {
        let lastStatus = 0;
        for (let i = 0; i < attempts; i++) {
            const result = await tryFetch(url);
            if (result.ok) {
                return result.blob;
            }
            lastStatus = result.status;
            if (result.status === 404 || result.status === 503) {
                if (i < attempts - 1) {
                    await new Promise((r) => setTimeout(r, 350 * (i + 1)));
                    continue;
                }
            }
            if (result.error) {
                throw result.error;
            }
            break;
        }
        throw new Error(`Storage fetch failed with status: ${lastStatus || 'unknown'}`);
    }

    console.log('🔄 Fetching image via proxy to bypass CORS:', url);
    const proxyEndpoint = import.meta.env.DEV ? '/__dev/proxy-image' : '/api/proxy';
    const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Proxy fetch failed with status: ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size < 500) {
        throw new Error('Proxied image payload too small');
    }
    return blob;
}

/**
 * Confirm a public Storage download URL returns an image (handles brief propagation lag).
 * @param {string} url
 * @param {{ attempts?: number, delayMs?: number }} [opts]
 */
export async function verifyPublicStorageImageUrl(url, { attempts = 6, delayMs = 450 } = {}) {
    if (!url || typeof url !== 'string') return false;
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(url, { method: 'GET', cache: 'no-store' });
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size >= 500) {
                    return true;
                }
            }
        } catch {
            /* retry */
        }
        if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
    }
    return false;
}

async function fetchServerAiCoverBlobViaApi(objectPath) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('not_signed_in');
    }
    const idToken = await user.getIdToken();
    const response = await fetch(`/api/storage-image?path=${encodeURIComponent(objectPath)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) {
        throw new Error(`storage_image_api_${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size < 500) {
        throw new Error('storage_image_too_small');
    }
    return blob;
}

async function publishAiCoverBlob(blob, userId, remoteUrl) {
    const blobPreview = URL.createObjectURL(blob);
    const file = new File([blob], `ai_cover_${Date.now()}.jpg`, {
        type: blob.type?.startsWith('image/') ? blob.type : 'image/jpeg',
    });
    try {
        const publishedUrl = await uploadMedia(file, userId, 'image', 'invitations');
        const ready = await verifyPublicStorageImageUrl(publishedUrl, { attempts: 5, delayMs: 400 });
        if (ready) {
            try {
                URL.revokeObjectURL(blobPreview);
            } catch {
                /* ignore */
            }
            return {
                source: 'ai_generated',
                type: 'image',
                file: null,
                url: publishedUrl,
                preview: publishedUrl,
                publishedUrl,
            };
        }

        console.warn('[publishAiCoverBlob] uploaded URL not yet publicly readable, falling back to blob preview:', publishedUrl);
        return {
            source: 'ai_generated',
            type: 'image',
            file,
            url: publishedUrl,
            preview: blobPreview,
            publishedUrl,
        };
    } catch (uploadErr) {
        console.warn('[prepareAiCoverMediaFromRemoteUrl] re-upload failed, keeping blob preview:', uploadErr);
        return {
            source: 'ai_generated',
            type: 'image',
            file,
            url: remoteUrl,
            preview: blobPreview,
        };
    }
}

/**
 * Download an AI cover, show a local blob preview, and publish to Storage when possible.
 * Avoids broken thumbnails from short-lived / CORS-blocked provider URLs in img tags.
 * @param {string} remoteUrl
 * @param {string} userId
 */
export async function prepareAiCoverMediaFromRemoteUrl(remoteUrl, userId) {
    if (isServerPersistedAiCoverUrl(remoteUrl)) {
        const ready = await verifyPublicStorageImageUrl(remoteUrl);
        if (ready) {
            return {
                source: 'ai_generated',
                type: 'image',
                file: null,
                url: remoteUrl,
                preview: remoteUrl,
                publishedUrl: remoteUrl,
            };
        }

        const objectPath = decodeFirebaseStorageObjectPath(remoteUrl);
        if (objectPath) {
            try {
                const blob = await fetchServerAiCoverBlobViaApi(objectPath);
                return publishAiCoverBlob(blob, userId, remoteUrl);
            } catch (apiErr) {
                console.warn('[prepareAiCoverMediaFromRemoteUrl] storage-image API fallback failed:', apiErr);
            }
        }

        try {
            const blob = await fetchRemoteImageBlob(remoteUrl);
            return publishAiCoverBlob(blob, userId, remoteUrl);
        } catch (remoteErr) {
            console.warn('[prepareAiCoverMediaFromRemoteUrl] direct fetch fallback failed:', remoteErr);
        }

        throw new Error('ai_cover_storage_not_ready');
    }

    const blob = await fetchRemoteImageBlob(remoteUrl);
    const blobPreview = URL.createObjectURL(blob);
    const file = new File([blob], `ai_cover_${Date.now()}.jpg`, {
        type: blob.type?.startsWith('image/') ? blob.type : 'image/jpeg',
    });

    try {
        const publishedUrl = await uploadMedia(file, userId, 'image', 'invitations');
        try {
            URL.revokeObjectURL(blobPreview);
        } catch {
            /* ignore */
        }
        return {
            source: 'ai_generated',
            type: 'image',
            file: null,
            url: publishedUrl,
            preview: publishedUrl,
            publishedUrl,
        };
    } catch (uploadErr) {
        console.warn('[prepareAiCoverMediaFromRemoteUrl] upload failed, keeping blob preview:', uploadErr);
        return {
            source: 'ai_generated',
            type: 'image',
            file,
            url: remoteUrl,
            preview: blobPreview,
        };
    }
}

/**
 * Re-upload a remote image (blocked Firebase path or external URL) to a public Storage folder.
 * @param {string} url
 * @param {string} userId
 * @param {string} [folder='invitations']
 * @returns {Promise<string|null>}
 */
export const ensurePublicImageUrl = async (url, userId, folder = 'invitations') => {
    return uploadGoogleImage(url, userId, folder);
};

/**
 * Persist a staged AI cover image to a public Storage folder when the user selects it.
 * @param {{ url?: string, preview?: string, publishedUrl?: string }} mediaData
 * @param {string} userId
 * @returns {Promise<string>}
 */
export const commitInvitationAiCover = async (mediaData, userId) => {
    if (mediaData?.publishedUrl) return mediaData.publishedUrl;
    if (mediaData?.file instanceof File) {
        const publishedUrl = await uploadMedia(mediaData.file, userId, 'image', 'invitations');
        if (!publishedUrl) {
            throw new Error('Failed to save AI cover image');
        }
        return publishedUrl;
    }
    const remoteUrl = mediaData?.url || mediaData?.preview;
    if (!remoteUrl || typeof remoteUrl !== 'string' || String(remoteUrl).startsWith('blob:')) {
        throw new Error('No AI image URL to commit');
    }
    if (isServerPersistedAiCoverUrl(remoteUrl)) {
        return remoteUrl;
    }
    const publishedUrl = await ensurePublicImageUrl(remoteUrl, userId, 'invitations');
    if (!publishedUrl) {
        throw new Error('Failed to save AI cover image');
    }
    return publishedUrl;
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
                // Upload custom image if file present; otherwise persist remote/AI URL to public folder
                let imageUrl;
                if (file) {
                    imageUrl = await uploadMedia(file, userId, 'image', 'invitations');
                } else if (mediaData.publishedUrl) {
                    imageUrl = mediaData.publishedUrl;
                } else {
                    const remoteUrl = url || mediaData.preview;
                    imageUrl = await ensurePublicImageUrl(remoteUrl, userId, 'invitations');
                }
                return {
                    mediaSource: 'custom_image',
                    customImage: imageUrl,
                    mediaType: 'image'
                };

            case 'ai_generated':
                let aiImageUrl;
                if (mediaData.publishedUrl) {
                    aiImageUrl = mediaData.publishedUrl;
                } else if (file) {
                    aiImageUrl = await uploadMedia(file, userId, 'image', 'invitations');
                } else {
                    aiImageUrl = await ensurePublicImageUrl(url || mediaData.preview, userId, 'invitations');
                }
                return {
                    mediaSource: 'custom_image',
                    customImage: aiImageUrl,
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
