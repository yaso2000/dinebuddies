/**
 * Shared path guards for scheduled Admin Storage cleanup.
 * Keep this module free of firebase-functions so unit tests can require it directly.
 *
 * Attack class: clients can plant any Firebase Storage download URL on docs they
 * control (stories.url, invitation media, chat message attachments). Scheduled
 * jobs previously Admin-deleted those paths blindly, destroying other users'
 * avatars/galleries/etc.
 */

/** Folder layouts: {prefix}{uid}/{fileName} */
const FOLDER_PREFIXES = [
    'stories/',
    'chat_images/',
    'chat-images/',
    'voice_messages/',
    'chat_files/',
    'avatars/',
    'covers/',
    'logos/',
    'gallery/',
    'menus/',
    'invitations/',
    'invitation_cards/',
    'users/',
    'featured_posts/',
    'community-posts/',
    'business_photos/',
    'feedback_media/',
];

/** Flat layouts: {prefix}{uid}_{rest} (see storage.rules uidPrefixed) */
const FLAT_PREFIXES = [
    'avatars/',
    'covers/',
    'premium_offers/',
    'offers/',
];

/**
 * Extract object path from a Firebase Storage download URL.
 * @param {unknown} url
 * @returns {string|null}
 */
function extractStorageObjectPath(url) {
    if (typeof url !== 'string' || !url.includes('firebasestorage') || !url.includes('/o/')) {
        return null;
    }
    try {
        const part = url.split('/o/')[1];
        if (!part) return null;
        return decodeURIComponent(part.split('?')[0]);
    } catch {
        return null;
    }
}

/**
 * True if path is under a known media prefix owned by one of ownerUids.
 * @param {string} path
 * @param {Iterable<string>|Set<string>} ownerUids
 */
function isOwnedStoragePath(path, ownerUids) {
    const normalized = String(path || '').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) return false;

    const owners = ownerUids instanceof Set
        ? ownerUids
        : new Set([...(ownerUids || [])].filter(Boolean).map(String));
    if (owners.size === 0) return false;

    for (const prefix of FLAT_PREFIXES) {
        if (!normalized.startsWith(prefix)) continue;
        const name = normalized.slice(prefix.length);
        // Folder form under the same prefix: avatars/{uid}/file
        const firstSeg = name.split('/')[0] || '';
        if (firstSeg && owners.has(firstSeg)) return true;
        for (const uid of owners) {
            if (name === uid || name.startsWith(`${uid}_`) || name.startsWith(`${uid}.`)) {
                return true;
            }
        }
    }

    for (const prefix of FOLDER_PREFIXES) {
        if (!normalized.startsWith(prefix)) continue;
        const rest = normalized.slice(prefix.length);
        const parts = rest.split('/').filter(Boolean);
        if (parts[0] && owners.has(parts[0])) return true;
        // Legacy invitations/{invitationId}/{userId}/{fileName}
        if (prefix === 'invitations/' && parts[1] && owners.has(parts[1])) return true;
    }

    return false;
}

/**
 * Collect owner UIDs commonly present on content docs.
 * @param {object} data
 * @returns {string[]}
 */
function contentOwnerIds(data) {
    if (!data || typeof data !== 'object') return [];
    return [
        data.userId,
        data.authorId,
        data.partnerId,
        data.senderId,
        data.ownerId,
        data.hostId,
        data.author && data.author.id,
    ].filter(Boolean).map(String);
}

/**
 * Delete a Storage object only when the URL path is owned by one of ownerUids.
 * @returns {Promise<boolean>} true if a delete was attempted (and not blocked)
 */
async function safeDeleteStorageUrl(bucket, url, ownerUids, log = console) {
    const path = extractStorageObjectPath(url);
    if (!path) return false;
    if (!isOwnedStoragePath(path, ownerUids)) {
        if (typeof log.warn === 'function') {
            log.warn('Storage delete blocked (unowned path)', { path });
        }
        return false;
    }
    try {
        await bucket.file(path).delete();
        return true;
    } catch (err) {
        if (err && err.code !== 404 && typeof log.warn === 'function') {
            log.warn('Storage delete failed:', path, err.message || err);
        }
        return false;
    }
}

module.exports = {
    FOLDER_PREFIXES,
    FLAT_PREFIXES,
    extractStorageObjectPath,
    isOwnedStoragePath,
    contentOwnerIds,
    safeDeleteStorageUrl,
};
