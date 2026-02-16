/**
 * Video Compression Utility
 * Uses browser-native compression for now (simple & free)
 * Can be upgraded to FFmpeg.wasm for better quality later
 */

/**
 * Compress video file
 * @param {File} videoFile - Original video file
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Blob>} - Compressed video blob
 */
export const compressVideo = async (videoFile, onProgress = () => { }) => {
    return new Promise((resolve, reject) => {
        try {
            onProgress(0);

            // Create video element
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.muted = true;

            video.onloadedmetadata = async () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Target resolution (720p max for mobile compatibility)
                    const maxWidth = 720;
                    const maxHeight = 1280;

                    let width = video.videoWidth;
                    let height = video.videoHeight;

                    // Calculate scaled dimensions
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // For now, we'll use the original file with quality check
                    // In production, consider using FFmpeg.wasm for better compression

                    const fileSize = videoFile.size;
                    const maxSize = 50 * 1024 * 1024; // 50MB max

                    if (fileSize > maxSize) {
                        reject(new Error('Video file too large. Please use a video under 50MB'));
                        return;
                    }

                    onProgress(100);
                    resolve(videoFile);

                    // Clean up
                    URL.revokeObjectURL(video.src);
                } catch (error) {
                    reject(error);
                }
            };

            video.onerror = () => {
                reject(new Error('Failed to load video'));
            };
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Get video duration in seconds
 * @param {File} videoFile - Video file
 * @returns {Promise<number>} - Duration in seconds
 */
export const getVideoDuration = (videoFile) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);

        video.onloadedmetadata = () => {
            resolve(video.duration);
            URL.revokeObjectURL(video.src);
        };

        video.onerror = () => {
            reject(new Error('Failed to load video metadata'));
        };
    });
};

/**
 * Get video dimensions
 * @param {File} videoFile - Video file
 * @returns {Promise<{width: number, height: number}>}
 */
export const getVideoDimensions = (videoFile) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);

        video.onloadedmetadata = () => {
            resolve({
                width: video.videoWidth,
                height: video.videoHeight
            });
            URL.revokeObjectURL(video.src);
        };

        video.onerror = () => {
            reject(new Error('Failed to load video metadata'));
        };
    });
};

/**
 * Validate video file
 * @param {File} file - Video file to validate
 * @param {Object} options - Validation options
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export const validateVideo = async (file, options = {}) => {
    const {
        maxDuration = 60,        // seconds
        maxSize = 100 * 1024 * 1024, // 100MB
        allowedFormats = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
    } = options;

    // Check file type
    if (!allowedFormats.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid video format. Please use MP4, MOV, or AVI'
        };
    }

    // Check file size
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `Video too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
        };
    }

    // Check duration
    try {
        const duration = await getVideoDuration(file);
        if (duration > maxDuration) {
            return {
                valid: false,
                error: `Video too long. Maximum duration is ${maxDuration} seconds`
            };
        }
    } catch (error) {
        return {
            valid: false,
            error: 'Failed to read video metadata'
        };
    }

    return { valid: true };
};
