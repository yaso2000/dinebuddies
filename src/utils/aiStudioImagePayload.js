/**
 * Normalized AI studio image passed via react-router location.state.
 * @param {string} publishedUrl
 */
export function buildAiStudioImagePayload(publishedUrl) {
    const url = String(publishedUrl || '').trim();
    return {
        source: 'ai_generated',
        type: 'image',
        url,
        preview: url,
        publishedUrl: url,
    };
}

/** @param {unknown} value */
export function parseAiStudioImageFromState(value) {
    if (!value || typeof value !== 'object') return null;
    const record = /** @type {Record<string, unknown>} */ (value);
    const publishedUrl =
        (typeof record.publishedUrl === 'string' && record.publishedUrl.trim()) ||
        (typeof record.url === 'string' && record.url.trim()) ||
        (typeof record.preview === 'string' && record.preview.trim()) ||
        '';
    if (!publishedUrl) return null;
    return buildAiStudioImagePayload(publishedUrl);
}
