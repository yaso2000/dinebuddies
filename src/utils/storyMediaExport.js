/**
 * Share/download a story's own media file (image or video) — separate from
 * sharePostMedia.js's `fetchPostImageFile`, which only accepts image MIME types.
 */
import { getRuntime } from '../platform/runtime';

/**
 * @param {string} mediaUrl
 * @param {'image'|'video'} kind
 * @returns {Promise<File|null>}
 */
export async function fetchStoryMediaFile(mediaUrl, kind = 'image') {
    if (!mediaUrl || typeof mediaUrl !== 'string') return null;
    try {
        const resp = await fetch(mediaUrl, { mode: 'cors', credentials: 'omit' });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        if (!blob?.size) return null;
        const ext = kind === 'video' ?
        (blob.type.includes('webm') ? 'webm' : 'mp4') :
        blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
        return new File([blob], `story.${ext}`, { type: blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg') });
    } catch {
        return null;
    }
}

/**
 * Native OS share sheet with the story's media file attached — falls back to
 * sharing just the caption text if the file/Web Share API isn't available.
 * @returns {Promise<'shared'|'cancelled'|'unavailable'|'failed'>}
 */
export async function shareStoryMedia({ mediaUrl, kind, text }) {
    if (typeof navigator === 'undefined' || !navigator.share) return 'unavailable';
    try {
        const file = mediaUrl ? await fetchStoryMediaFile(mediaUrl, kind) : null;
        const payload = file ?
        { files: [file], text: text || '' } :
        { text: text || '' };
        if (file && !navigator.canShare?.(payload)) {
            delete payload.files;
        }
        if (!payload.files && !payload.text) return 'unavailable';
        await navigator.share(payload);
        return 'shared';
    } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
        console.error('Story share error:', err);
        return 'failed';
    }
}

/**
 * Save the story's media to the device.
 * - Web: direct blob download via a hidden <a download>.
 * - Native (Capacitor WebView): no Filesystem plugin installed — the native OS share
 *   sheet's own "Save Image/Video" target is the closest available equivalent, so we
 *   route through the same share flow there instead.
 * @returns {Promise<'downloaded'|'shared'|'cancelled'|'unavailable'|'failed'>}
 */
export async function downloadStoryMedia({ mediaUrl, kind, text }) {
    if (!mediaUrl) return 'unavailable';

    if (getRuntime().isNative) {
        return shareStoryMedia({ mediaUrl, kind, text });
    }

    try {
        const file = await fetchStoryMediaFile(mediaUrl, kind);
        if (!file) return 'failed';
        const blobUrl = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
        return 'downloaded';
    } catch (err) {
        console.error('Story download error:', err);
        return 'failed';
    }
}
