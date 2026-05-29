import { normalizeStudioTextAnimation } from '../features/motion-post/studio/studioTextAnimation';

/** Map Gemini animation_type → Smart Post Studio rail id. */
export function mapAiAnimationToStudio(animationType) {
    const map = {
        'slide-up': 'slide',
        'fade-in': 'fade',
        'zoom-in': 'zoom',
    };
    return normalizeStudioTextAnimation(map[String(animationType || '').trim()] || 'slide');
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string | null}
 */
export function extractAIImageUrl(data) {
    if (!data || typeof data !== 'object') return null;
    const image = data.image;
    if (typeof image === 'string' && image.trim()) return image.trim();
    if (image && typeof image === 'object') {
        const record = /** @type {Record<string, unknown>} */ (image);
        const nested =
            record.mediaLibraryItem &&
            typeof record.mediaLibraryItem === 'object' &&
            /** @type {Record<string, unknown>} */ (record.mediaLibraryItem).url;
        if (typeof nested === 'string' && nested.trim()) return nested.trim();
        if (typeof record.url === 'string' && record.url.trim()) return record.url.trim();
    }
    return null;
}

/**
 * @param {'invitation' | 'regular_post' | 'featured_post' | 'animated_post'} postType
 * @param {Record<string, unknown>} data
 * @returns {Record<string, unknown>}
 */
export function extractAIContentFields(postType, data) {
    if (!data || typeof data !== 'object') return {};

    switch (postType) {
        case 'invitation': {
            const title = typeof data.title === 'string' ? data.title.trim() : '';
            const description = typeof data.description === 'string' ? data.description.trim() : '';
            return {
                title: title.slice(0, 120),
                description,
            };
        }

        case 'regular_post':
            return {
                text: typeof data.text === 'string' ? data.text.trim() : '',
            };

        case 'featured_post':
            return {
                title: typeof data.title === 'string' ? data.title.trim() : '',
                description: typeof data.description === 'string' ? data.description.trim() : '',
            };

        case 'animated_post':
            return {
                title: typeof data.title === 'string' ? data.title.trim() : '',
                description: typeof data.description === 'string' ? data.description.trim() : '',
                animation_type: typeof data.animation_type === 'string' ? data.animation_type.trim() : '',
            };

        default:
            return {};
    }
}
