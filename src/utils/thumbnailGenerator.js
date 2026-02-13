/**
 * Thumbnail Generator Utility
 * Generates thumbnail from video file
 */

/**
 * Generate thumbnail from video file
 * @param {File} videoFile - Video file
 * @param {number} timeInSeconds - Time to capture (default: 0.5 seconds)
 * @returns {Promise<Blob>} - Thumbnail image blob
 */
export const generateThumbnail = (videoFile, timeInSeconds = 0.5) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let objectUrl = null;

        const cleanup = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            video.removeAttribute('src');
            video.load();
        };

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Thumbnail generation timeout'));
        }, 5000);

        try {
            objectUrl = URL.createObjectURL(videoFile);
            video.src = objectUrl;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous'; // Good practice even for local blobs sometimes

            // Step 1: Wait for metadata/data to be ready
            video.onloadeddata = () => {
                // Determine seek time
                const seekTime = Math.min(timeInSeconds, video.duration > 0 ? video.duration / 2 : 0);
                video.currentTime = seekTime;
            };

            // Step 2: Wait for seek to complete (frame ready)
            video.onseeked = () => {
                try {
                    // Resize canvas
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;

                    // Draw
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Export
                    canvas.toBlob((blob) => {
                        clearTimeout(timeout);
                        cleanup();
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Thumbnail blob creation failed'));
                        }
                    }, 'image/jpeg', 0.7);
                } catch (e) {
                    clearTimeout(timeout);
                    cleanup();
                    reject(e);
                }
            };

            video.onerror = (e) => {
                clearTimeout(timeout);
                cleanup();
                reject(new Error('Video load error'));
            };

            // Trigger load (sometimes needed)
            video.load();
        } catch (e) {
            clearTimeout(timeout);
            cleanup();
            reject(e);
        }
    });
};

/**
 * Generate multiple thumbnails from video
 * @param {File} videoFile - Video file
 * @param {number} count - Number of thumbnails to generate
 * @returns {Promise<Blob[]>} - Array of thumbnail blobs
 */
export const generateMultipleThumbnails = async (videoFile, count = 3) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.preload = 'metadata';

        video.onloadedmetadata = async () => {
            const duration = video.duration;
            const interval = duration / (count + 1);
            const thumbnails = [];

            try {
                for (let i = 1; i <= count; i++) {
                    const time = interval * i;
                    const thumbnail = await generateThumbnailAtTime(video, time);
                    thumbnails.push(thumbnail);
                }
                resolve(thumbnails);
                URL.revokeObjectURL(video.src);
            } catch (error) {
                reject(error);
                URL.revokeObjectURL(video.src);
            }
        };

        video.onerror = () => {
            reject(new Error('Failed to load video'));
            URL.revokeObjectURL(video.src);
        };

        video.load();
    });
};

/**
 * Helper: Generate thumbnail at specific time
 */
const generateThumbnailAtTime = (video, time) => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.currentTime = time;

        const onSeeked = () => {
            try {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to generate thumbnail'));
                        }
                    },
                    'image/jpeg',
                    0.9
                );

                video.removeEventListener('seeked', onSeeked);
            } catch (error) {
                video.removeEventListener('seeked', onSeeked);
                reject(error);
            }
        };

        video.addEventListener('seeked', onSeeked);
    });
};

/**
 * Generate thumbnail URL (for preview)
 * @param {File} videoFile - Video file
 * @param {number} timeInSeconds - Time to capture
 * @returns {Promise<string>} - Data URL
 */
export const generateThumbnailURL = async (videoFile, timeInSeconds = 0.5) => {
    const blob = await generateThumbnail(videoFile, timeInSeconds);
    return URL.createObjectURL(blob);
};
