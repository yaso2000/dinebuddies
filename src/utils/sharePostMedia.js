/**
 * Fetch a post image for native share (WhatsApp, system share sheet).
 */

const getProxyImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) return null;
    try {
        const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
        const endpoint = import.meta.env.DEV ? '/__dev/proxy-image' : '/api/proxy';
        return `${base}${endpoint}?url=${encodeURIComponent(imageUrl)}`;
    } catch {
        return null;
    }
};

const resolveImageUrl = (src) => {
    if (!src || typeof src !== 'string') return '';
    const s = src.trim();
    if (s.startsWith('data:') || s.startsWith('blob:')) return s;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('//') && typeof window !== 'undefined' && window.location?.protocol) {
        return `${window.location.protocol}${s}`;
    }
    if (s.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${s}`;
    }
    return s;
};

/**
 * @param {string} imageUrl
 * @returns {Promise<File | null>}
 */
export async function fetchPostImageFile(imageUrl) {
    const resolved = resolveImageUrl(imageUrl);
    if (!resolved) return null;

    if (resolved.startsWith('data:')) {
        try {
            const resp = await fetch(resolved);
            const blob = await resp.blob();
            if (!blob?.size) return null;
            return new File([blob], 'post.png', { type: blob.type || 'image/png' });
        } catch {
            return null;
        }
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const sameOrigin = origin && resolved.startsWith(origin);
    const tryUrls = sameOrigin ? [resolved] : [resolved, getProxyImageUrl(resolved)].filter(Boolean);

    for (const fetchUrl of tryUrls) {
        try {
            const resp = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
            if (!resp.ok) continue;
            const blob = await resp.blob();
            if (!blob?.size || !blob.type.startsWith('image/')) continue;
            const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
            return new File([blob], `post.${ext}`, { type: blob.type });
        } catch {
            /* try next */
        }
    }
    return null;
}

/**
 * @param {{ file: File, title?: string, text?: string, url?: string }} opts
 */
export async function nativeShareWithImage({ file, title, text, url }) {
    if (!file || typeof navigator === 'undefined' || !navigator.share) return false;
    const payload = {
        files: [file],
        title: title || '',
        text: [text, url].filter(Boolean).join('\n\n'),
    };
    if (url && navigator.canShare?.({ ...payload, url })) {
        payload.url = url;
    }
    if (!navigator.canShare?.(payload)) {
        delete payload.url;
        if (!navigator.canShare?.(payload)) return false;
    }
    await navigator.share(payload);
    return true;
}
