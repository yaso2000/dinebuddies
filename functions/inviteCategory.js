/** Canonical invitation category for admin filters (public | private | dating). */
const CANONICAL = new Set(['public', 'private', 'dating']);

function isDatingInvitationDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Dating' ||
        occasionLc === 'dating' ||
        (inv.datingInvitationPreference != null && inv.datingInvitationPreference !== false)
    );
}

/**
 * @param {Record<string, unknown>} d
 * @param {'public'|'private'} collectionKind
 */
function inferInviteCategory(d, collectionKind) {
    const raw = String(d.inviteCategory || '').toLowerCase();
    if (CANONICAL.has(raw)) return raw;
    if (collectionKind === 'public') return 'public';
    if (isDatingInvitationDoc(d)) return 'dating';
    return 'private';
}

module.exports = { inferInviteCategory, isDatingInvitationDoc, CANONICAL };
