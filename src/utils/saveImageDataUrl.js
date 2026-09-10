import { isIOS } from '../services/notificationService';

/**
 * Save (or share, on iOS) a PNG given as a data: URL. Mirrors saveRemoteImage but
 * for locally generated images (e.g. a composed QR card).
 *
 * @param {string} dataUrl  data:image/png;base64,...
 * @param {string} filename
 * @returns {Promise<'shared' | 'downloaded' | 'cancelled'>}
 */
export async function saveImageDataUrl(dataUrl, filename) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: blob.type || 'image/png' });

  // Prefer the native share sheet when it can handle files (best on mobile — lets
  // the user save to Photos, send to the business via chat, etc.). iOS Safari
  // ignores `<a download>`, so share is the only reliable save path there.
  const canShareFiles =
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

  if (canShareFiles && (isIOS() || typeof navigator.canShare === 'function')) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // fall through to download on any share failure
    }
  }

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
