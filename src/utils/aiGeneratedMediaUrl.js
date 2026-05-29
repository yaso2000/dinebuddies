/** Storage object prefixes that storage.rules expose with allow read: if true */
const PUBLIC_FIREBASE_PREFIXES = [
    'invitations/',
    'community-posts/',
    'featured_posts/',
    'business-motion/',
    'avatars/',
    'covers/',
    'logos/',
    'gallery/',
    'menus/',
    'stories/',
    'premium_offers/',
    'offers/',
    'invitation_cards/',
    'business_photos/',
];

/**
 * Decode the object path from a Firebase Storage download URL.
 * @param {string} url
 * @returns {string}
 */
export function decodeFirebaseStorageObjectPath(url) {
    if (typeof url !== 'string' || !url.includes('firebasestorage.googleapis.com')) return '';
    const match = url.match(/\/o\/([^?]+)/);
    if (!match?.[1]) return '';
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

/**
 * True when the URL points to a Firebase object that is not publicly readable.
 * @param {string} url
 */
export function isRestrictedFirebaseStorageUrl(url) {
    const objectPath = decodeFirebaseStorageObjectPath(url);
    if (!objectPath) return false;
    if (objectPath.startsWith('users/') && objectPath.includes('/invitations/ai/')) return true;
    return !PUBLIC_FIREBASE_PREFIXES.some((prefix) => objectPath.startsWith(prefix));
}

/**
 * Firebase Storage / HTTPS URL from AI generation (preview set without a local File).
 *
 * @param {{ preview?: string, url?: string } | null | undefined} media
 * @returns {string}
 */
export function pickAiRemoteImageUrl(media) {
    const candidate = media?.url || media?.preview;
    if (typeof candidate !== 'string') return '';
    const trimmed = candidate.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}
