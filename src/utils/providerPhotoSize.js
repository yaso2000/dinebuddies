/**
 * Requests a higher-resolution image from Google/Facebook OAuth account photo
 * CDNs by rewriting the size parameter. Firebase Auth persists whatever size
 * the provider handed back at sign-in (often a ~96px thumbnail), which looks
 * pixelated once stretched across a swipe card or profile header.
 *
 * Leaves signed/hashed CDN URLs (fbcdn.net, platform-lookaside.fbsbx.com)
 * untouched — those bake width/height into a delivery signature, so changing
 * them breaks the image instead of upsizing it.
 *
 * Zero internal imports so both `avatarUtils.js` and `profileGallery.js` can
 * use it without risking a circular import between them.
 */
export function upsizeProviderPhotoUrl(url, size = 512) {
    if (!url || typeof url !== 'string') return url;
    const u = url.trim();

    if (/^https?:\/\/lh\d+\.googleusercontent\.com\//i.test(u)) {
        if (/=s\d+/i.test(u)) {
            return u.replace(/=s\d+(-c)?/i, `=s${size}-c`);
        }
        return `${u}=s${size}-c`;
    }

    if (/^https?:\/\/graph\.facebook\.com\/[^/]+\/picture/i.test(u)) {
        const [base, query = ''] = u.split('?');
        const params = new URLSearchParams(query);
        params.delete('type');
        params.set('width', String(size));
        params.set('height', String(size));
        return `${base}?${params.toString()}`;
    }

    return u;
}
