import {
    IMAGE_MODERATION_REJECTED,
    IMAGE_MODERATION_UNAVAILABLE,
    IMAGE_MODERATION_NO_FACE,
    isImageModerationRejected,
    isImageModerationUnavailable,
    isImageModerationNoFace,
} from '../services/moderatedImageUpload';

/**
 * Pick a translated toast message for image upload / moderation failures.
 * @param {unknown} error
 * @param {(key: string, opts?: object) => string} t
 * @param {string} [fallbackKey='failed_upload_image']
 * @returns {string}
 */
export function getImageUploadErrorMessage(error, t, fallbackKey = 'failed_upload_image') {
    if (String(error?.code || '').includes('resource-exhausted')) {
        return t('image_upload_rate_limited', 'You have uploaded too many photos today. Please try again later.');
    }
    if (error?.code === IMAGE_MODERATION_NO_FACE || isImageModerationNoFace(error)) {
        return t('image_rejected_no_face', 'The profile photo must clearly show a human face. Please choose another photo.');
    }
    if (error?.code === IMAGE_MODERATION_REJECTED || isImageModerationRejected(error)) {
        return t('image_rejected_policy');
    }
    if (error?.code === IMAGE_MODERATION_UNAVAILABLE || isImageModerationUnavailable(error)) {
        return t('image_moderation_unavailable');
    }
    return t(fallbackKey);
}

/**
 * Show a visible toast for upload/moderation failures (longer for rejected images).
 * @param {(msg: string, type?: string, onClick?: null, durationMs?: number) => void} showToast
 */
export function notifyImageUploadError(showToast, error, t, fallbackKey = 'failed_upload_image') {
    const soft = isImageModerationRejected(error) || isImageModerationNoFace(error);
    const message = getImageUploadErrorMessage(error, t, fallbackKey);
    showToast(message, soft ? 'warning' : 'error', null, soft ? 9000 : 5000);
}
