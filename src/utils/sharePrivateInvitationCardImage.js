import { captureElementAsPngFile } from './privateInvitationCardCapture';
import { openSmsWithBodyOnly } from './bulkSms';

/**
 * @param {File} file
 */
export function downloadInvitationImageFile(file) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name || 'dinebuddies-invitation.png';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

/**
 * Build share text with optional link inline (never pass `url` with `files` — breaks SMS/Messages on mobile).
 * @param {{ text?: string, url?: string }} opts
 */
export function buildInvitationCardShareText(opts = {}) {
    const text = (opts.text || '').trim();
    const url = (opts.url || '').trim();
    if (text && url && !text.includes(url)) return `${text}\n\n${url}`;
    return text || url;
}

/**
 * Share invitation card as PNG (WhatsApp / SMS / Telegram show image when OS supports file share).
 * @param {HTMLElement | null} element
 * @param {{ title?: string, text?: string, url?: string, filename?: string }} opts
 * @returns {Promise<'native'|'native-text-only'|'downloaded'|'aborted'|'failed'>}
 */
export async function sharePrivateInvitationCardImage(element, opts = {}) {
    const file = await captureElementAsPngFile(
        element,
        opts.filename || 'dinebuddies-invitation.png'
    );
    if (!file) return 'failed';

    const title = opts.title || '';
    const combinedText = buildInvitationCardShareText({ text: opts.text, url: opts.url });

    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            /** @type {ShareData} */
            const fileShareData = { files: [file] };
            if (title) fileShareData.title = title;
            if (combinedText) fileShareData.text = combinedText;

            const canShareFiles =
                !navigator.canShare || navigator.canShare(fileShareData);

            if (canShareFiles) {
                await navigator.share(fileShareData);
                return 'native';
            }

            // Some mobile browsers report canShare false but still accept files.
            try {
                await navigator.share(fileShareData);
                return 'native';
            } catch (fileShareError) {
                if (fileShareError?.name === 'AbortError') return 'aborted';
            }

            if (combinedText || opts.url) {
                await navigator.share({
                    title,
                    text: combinedText || title,
                    url: opts.url || undefined,
                });
                return 'native-text-only';
            }
        } catch (e) {
            if (e?.name === 'AbortError') return 'aborted';
        }
    }

    downloadInvitationImageFile(file);
    return 'downloaded';
}

/**
 * @deprecated Use sharePrivateInvitationCardImage — deep links cannot attach images to SMS.
 */
export async function shareInvitationCardImageWithDeepLink(element, deepLinkUrl, opts = {}) {
    const result = await sharePrivateInvitationCardImage(element, opts);
    if (result === 'downloaded' && deepLinkUrl) {
        window.open(deepLinkUrl, '_blank', 'noopener,noreferrer');
    }
    return result;
}

/**
 * Open SMS/Messages with invitation card image when the OS supports it (Web Share + files → MMS).
 * Falls back to sms: body + clipboard/download when file share is unavailable.
 *
 * @param {HTMLElement | null} element
 * @param {{ title?: string, text?: string, url?: string, filename?: string }} opts
 * @returns {Promise<'shared-with-image'|'opened-clipboard'|'opened-download'|'aborted'|'failed'>}
 */
export async function openInvitationDirectSms(element, opts = {}) {
    const file = await captureElementAsPngFile(
        element,
        opts.filename || 'dinebuddies-invitation.png'
    );
    if (!file) return 'failed';

    const combinedText = buildInvitationCardShareText({ text: opts.text, url: opts.url });
    if (!combinedText) return 'failed';

    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            /** @type {ShareData} */
            const fileShareData = { files: [file], text: combinedText };
            if (opts.title) fileShareData.title = opts.title;

            const canShareFiles =
                !navigator.canShare || navigator.canShare(fileShareData);

            if (canShareFiles) {
                await navigator.share(fileShareData);
                return 'shared-with-image';
            }

            try {
                await navigator.share(fileShareData);
                return 'shared-with-image';
            } catch (fileShareError) {
                if (fileShareError?.name === 'AbortError') return 'aborted';
            }
        } catch (e) {
            if (e?.name === 'AbortError') return 'aborted';
        }
    }

    let imageMode = 'download';

    try {
        if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard?.write &&
            typeof ClipboardItem !== 'undefined'
        ) {
            const blob = file instanceof Blob ? file : new Blob([file], { type: 'image/png' });
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            imageMode = 'clipboard';
        }
    } catch {
        /* clipboard not available — fall back to download */
    }

    if (imageMode !== 'clipboard') {
        downloadInvitationImageFile(file);
    }

    await new Promise((resolve) => setTimeout(resolve, imageMode === 'clipboard' ? 80 : 250));

    if (!openSmsWithBodyOnly(combinedText)) {
        return 'failed';
    }

    return imageMode === 'clipboard' ? 'opened-clipboard' : 'opened-download';
}
