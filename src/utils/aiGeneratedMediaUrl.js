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
    'ai-design-studio/',
];

/**
 * Decode the GCS bucket id from a Firebase Storage download URL.
 * @param {string} url
 * @returns {string}
 */
export function decodeFirebaseStorageBucketName(url) {
    if (typeof url !== 'string') return '';

    const match = url.match(/\/v0\/b\/([^/]+)\/o\//);
    if (!match?.[1]) return '';

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

/** Folders where server-side AI uploads land (see resolveAiStorageFolder). */
const SERVER_AI_STORAGE_PREFIXES = [
    'invitations/',
    'ai-design-studio/',
    'community-posts/',
    'featured_posts/',
    'business-motion/',
];

const SERVER_AI_OBJECT_PATH =
    /^(invitations|ai-design-studio|community-posts|featured_posts|business-motion)\/[^/]+\/ai_\d+_[a-f0-9-]+\.(png|jpe?g|webp)$/i;

/**
 * Decode the object path from a Firebase Storage download URL.
 * @param {string} url
 * @returns {string}
 */
export function decodeFirebaseStorageObjectPath(url) {
    if (typeof url !== 'string') return '';

    const pathMatch = url.match(/\/o\/([^?]+)/);
    if (pathMatch?.[1]) {
        try {
            return decodeURIComponent(pathMatch[1]);
        } catch {
            return pathMatch[1];
        }
    }

    const storageMatch = url.match(/https:\/\/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/i);
    if (storageMatch?.[1]) {
        try {
            return decodeURIComponent(storageMatch[1]);
        } catch {
            return storageMatch[1];
        }
    }

    return '';
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
 * True when URL is a server-uploaded AI image in a public Storage folder.
 * @param {string} url
 */
export function isServerPersistedAiCoverUrl(url) {
    if (typeof url !== 'string') {
        return false;
    }
    if (isRestrictedFirebaseStorageUrl(url)) {
        return false;
    }
    const objectPath = decodeFirebaseStorageObjectPath(url);
    if (!objectPath) return false;
    if (!SERVER_AI_STORAGE_PREFIXES.some((prefix) => objectPath.startsWith(prefix))) {
        return false;
    }
    return SERVER_AI_OBJECT_PATH.test(objectPath);
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
