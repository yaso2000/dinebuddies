import { captureElementAsPngFile } from './privateInvitationCardCapture';
import { openSmsWithBodyOnly } from './bulkSms';
import { isAndroid, isIOS } from '../services/notificationService';

function isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    return isIOS() || isAndroid();
}

/**
 * @param {string} text
 */
export async function copyInvitationShareText(text) {
    const value = String(text || '').trim();
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        return false;
    }
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {File} file
 */
export function downloadInvitationImageFile(file) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name || 'dinebuddies-invitation.jpg';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

/**
 * Build share text with the app / profile link inline (link must not be passed separately to Web Share).
 * @param {{ text?: string, url?: string }} opts
 */
export function buildInvitationCardShareText(opts = {}) {
    const text = (opts.text || '').trim();
    const url = (opts.url || '').trim();
    if (text && url) {
        if (text.includes(url)) return text;
        return `${text}\n\n${url}`;
    }
    return text || url;
}

/**
 * Pre-render invitation card JPEG for native share.
 * @param {HTMLElement | null} element
 * @returns {Promise<File | null>}
 */
export async function prepareInvitationShareFile(element) {
    if (!element) return null;
    return captureElementAsPngFile(element, 'dinebuddies-invitation.jpg', { forShare: true });
}

/**
 * Share image + full message. URL lives inside text only — avoids duplicate WhatsApp link previews.
 * @param {{ file?: File | null, title?: string, text?: string }} opts
 * @returns {Promise<'native'|'native-text-only'|'downloaded'|'aborted'|'failed'>}
 */
export async function presentInvitationNativeShare(opts = {}) {
    const { file = null, title = '', text = '' } = opts;
    const combinedText = String(text || '').trim();

    if (typeof navigator === 'undefined' || !navigator.share) {
        if (isMobileDevice()) return 'failed';
        if (file) {
            downloadInvitationImageFile(file);
            return 'downloaded';
        }
        return 'failed';
    }

    /** @type {ShareData[]} */
    const attempts = [];

    if (file && combinedText) {
        attempts.push({
            files: [file],
            text: combinedText,
            title: title || undefined,
        });
    }

    if (file) {
        attempts.push({ files: [file] });
    }

    if (combinedText) {
        attempts.push({
            title: title || undefined,
            text: combinedText,
        });
    }

    for (const payload of attempts) {
        const cleaned = Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value != null && value !== '')
        );
        if (!Object.keys(cleaned).length) continue;

        try {
            if (typeof navigator.canShare === 'function' && !navigator.canShare(cleaned)) {
                continue;
            }
            await navigator.share(cleaned);
            return cleaned.files ? 'native' : 'native-text-only';
        } catch (e) {
            if (e?.name === 'AbortError') return 'aborted';
        }
    }

    if (isMobileDevice()) {
        return 'failed';
    }

    if (file) {
        downloadInvitationImageFile(file);
        return 'downloaded';
    }

    return 'failed';
}

/**
 * One-shot share: card image + formatted text (app/profile link embedded in text).
 * @param {{ file?: File | null, title?: string, text?: string, url?: string, skipClipboardCopy?: boolean }} opts
 * @returns {Promise<'native'|'native-text-only'|'downloaded'|'aborted'|'failed'>}
 */
export async function shareSocialInvitationCardImage(opts = {}) {
    const combinedText = buildInvitationCardShareText({ text: opts.text, url: opts.url });
    const shouldCopy = combinedText && !opts.skipClipboardCopy;

    if (shouldCopy && isAndroid()) {
        void copyInvitationShareText(combinedText);
    } else if (shouldCopy) {
        await copyInvitationShareText(combinedText);
    }

    const file = opts.file || null;
    if (!file && !combinedText) return 'failed';

    return presentInvitationNativeShare({
        file,
        title: opts.title || '',
        text: combinedText,
    });
}

/**
 * @deprecated Use shareSocialInvitationCardImage — deep links cannot attach images to SMS.
 */
export async function shareInvitationCardImageWithDeepLink(_element, deepLinkUrl, opts = {}) {
    const result = await shareSocialInvitationCardImage(opts);
    if (result === 'downloaded' && deepLinkUrl && !isMobileDevice()) {
        window.open(deepLinkUrl, '_blank', 'noopener,noreferrer');
    }
    return result;
}

/**
 * Open SMS/Messages with invitation card image when the OS supports it (Web Share + files → MMS).
 * @param {HTMLElement | null} element
 * @param {{ title?: string, text?: string, url?: string, filename?: string, cachedFile?: File | null }} opts
 * @returns {Promise<'shared-with-image'|'opened-clipboard'|'opened-download'|'aborted'|'failed'>}
 */
export async function openInvitationDirectSms(element, opts = {}) {
    const combinedText = buildInvitationCardShareText({ text: opts.text, url: opts.url });
    if (!combinedText) return 'failed';

    let file = opts.cachedFile || null;
    if (!file && element) {
        file = await prepareInvitationShareFile(element);
    }

    const shareResult = await shareSocialInvitationCardImage({
        file,
        title: opts.title || '',
        text: opts.text || '',
        url: opts.url || '',
    });

    if (shareResult === 'native') return 'shared-with-image';
    if (shareResult === 'aborted') return 'aborted';
    if (shareResult === 'native-text-only') return 'shared-with-image';

    if (isMobileDevice()) {
        if (!openSmsWithBodyOnly(combinedText)) return 'failed';
        return 'opened-clipboard';
    }

    return 'failed';
}
