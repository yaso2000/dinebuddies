/** Returns true if bio text looks like external URLs or social handles (profile policy). */
export function containsExternalLinks(text) {
    if (!text || typeof text !== 'string') return false;
    const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
    return urlPattern.test(text);
}
