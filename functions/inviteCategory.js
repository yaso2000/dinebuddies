/** Canonical invitation category for admin filters (public | social | private). */
const CANONICAL = new Set(['public', 'social', 'private', 'dating']); // dating = legacy

function isPrivateInviteDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Private' ||
        inv.type === 'Dating' ||
        occasionLc === 'private' ||
        occasionLc === 'dating' ||
        (inv.privateInvitationPreference != null && inv.privateInvitationPreference !== false) ||
        (inv.datingInvitationPreference != null && inv.datingInvitationPreference !== false)
    );
}

function isSocialInviteDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    if (isPrivateInviteDoc(inv)) return false;
    const cat = String(inv.inviteCategory || '').toLowerCase();
    const type = String(inv.type || '');
    return cat === 'social' || type === 'Social' || type === 'Private'; // legacy Private type = social
}

/**
 * @param {Record<string, unknown>} d
 * @param {'public'|'private'} collectionKind
 */
function inferInviteCategory(d, collectionKind) {
    const raw = String(d.inviteCategory || '').toLowerCase();
    if (raw === 'dating') return 'private';
    if (raw === 'social' || raw === 'private') return raw === 'private' && isPrivateInviteDoc(d) ? 'private' : raw === 'private' && !isPrivateInviteDoc(d) ? 'social' : raw;
    if (CANONICAL.has(raw)) return raw === 'dating' ? 'private' : raw;
    if (collectionKind === 'public') return 'public';
    if (isPrivateInviteDoc(d)) return 'private';
    return 'social';
}

module.exports = { inferInviteCategory, isPrivateInviteDoc, isSocialInviteDoc, CANONICAL };
