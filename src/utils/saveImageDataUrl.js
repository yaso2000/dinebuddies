import { isIOS } from '../services/notificationService';

/**
 * Save (or share) a PNG given as a data: URL, as reliably as possible across
 * desktop, Android and iOS / in-app WebViews:
 *   1) native share sheet when it can take files (best on mobile → Save to Photos),
 *   2) a direct `<a download>` (desktop + Android Chrome),
 *   3) open the image in a new tab so the user can long-press → Save (last resort,
 *      covers iOS Safari and WebViews where download is inert).
 *
 * @returns {Promise<'shared' | 'downloaded' | 'opened' | 'cancelled'>}
 */
export async function saveImageDataUrl(dataUrl, filename) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: blob.type || 'image/png' });

  // 1) Share sheet — the most reliable "save to device" path on mobile.
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // fall through to download / open
    }
  }

  const objectUrl = URL.createObjectURL(blob);

  // 2) Direct download — reliable on desktop and Android Chrome, inert on iOS Safari.
  if (!isIOS()) {
    try {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      return 'downloaded';
    } catch {
      /* fall through to open */
    }
  }

  // 3) Open in a new tab → user long-presses to save (iOS / WebView fallback).
  try {
    window.open(objectUrl, '_blank', 'noopener');
  } catch {
    /* ignore */
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 20000);
  return 'opened';
}
