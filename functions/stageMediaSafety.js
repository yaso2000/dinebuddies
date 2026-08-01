/**
 * Shared path guards for Stage room Storage cleanup.
 * Keep this module free of firebase-functions so unit tests can require it directly.
 */

/** Prefixes stage chat / banner uploads are allowed to use (see mediaUtils + moderateImage). */
const STAGE_MEDIA_PREFIXES = [
    'chat_images/',
    'chat-images/',
    'voice_messages/',
    'chat_files/',
];

/**
 * Only delete Storage objects that look like stage-chat media owned by a stage member.
 * Forged message/banner URLs pointing at avatars, galleries, invitations, etc. must not be wiped.
 * @param {string} path
 * @param {Set<string>|string[]} memberUidSet
 */
function isSafeStageMediaPath(path, memberUidSet) {
    const normalized = String(path || '').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) return false;
    const members = memberUidSet instanceof Set ? memberUidSet : new Set(memberUidSet || []);
    for (const prefix of STAGE_MEDIA_PREFIXES) {
        if (!normalized.startsWith(prefix)) continue;
        const rest = normalized.slice(prefix.length);
        const ownerUid = rest.split('/')[0] || '';
        if (ownerUid && members.has(ownerUid)) return true;
    }
    return false;
}

function extractStorageObjectPath(url) {
    if (typeof url !== 'string' || !url.includes('firebasestorage.googleapis.com')) return null;
    const match = url.match(/\/o\/([^?]+)/);
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

module.exports = {
    STAGE_MEDIA_PREFIXES,
    isSafeStageMediaPath,
    extractStorageObjectPath,
};
