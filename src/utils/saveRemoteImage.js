import { isIOS } from '../services/notificationService';

/**
 * Fetch a remote image and save it on device.
 * iOS Safari ignores `<a download>` and opens blob URLs as a file preview — use Web Share instead.
 *
 * @param {string} url
 * @param {string} filename
 * @returns {Promise<'shared' | 'downloaded' | 'cancelled'>}
 */
export async function saveOrShareRemoteImage(url, filename) {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
        throw new Error('download_failed');
    }

    const blob = await response.blob();
    const mime =
        blob.type ||
        (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    const file = new File([blob], filename, { type: mime });

    // iOS Safari ignores `<a download>` — Web Share is the reliable save path.
    if (isIOS() && typeof navigator.share === 'function') {
        const sharePayload = { files: [file], title: filename };
        const canShareFiles =
            typeof navigator.canShare !== 'function' || navigator.canShare(sharePayload);

        if (canShareFiles) {
            try {
                await navigator.share(sharePayload);
                return 'shared';
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return 'cancelled';
                }
                throw err;
            }
        }

        throw new Error('ios_share_unavailable');
    }

    // Android + desktop: direct file download
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    return 'downloaded';
}
