/**
 * Web Share API when available; otherwise copy text and open WhatsApp.
 * @param {{ file?: File | null, title?: string, text?: string, url?: string, skipExternalFallback?: boolean }} opts
 * @returns {Promise<'native'|'aborted'|'external'|'no-api'>}
 */
export async function shareNativeOrFallback({
    file = null,
    title = '',
    text = '',
    url = '',
    skipExternalFallback = false,
}) {
    const combined = [text, url].filter(Boolean).join('\n\n') || url || text || title || '';

    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            if (file && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title, text: text || title, url });
            } else {
                await navigator.share({ title, text: combined || title, url });
            }
            return 'native';
        } catch (e) {
            if (e?.name === 'AbortError') return 'aborted';
            if (skipExternalFallback) return 'no-api';
        }
    } else if (skipExternalFallback) {
        return 'no-api';
    }

    if (skipExternalFallback) return 'no-api';

    try {
        await navigator.clipboard?.writeText?.(combined);
    } catch (_) {
        /* ignore */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(combined)}`, '_blank', 'noopener,noreferrer');
    return 'external';
}
