/**
 * Shared block/mute messaging restriction checks (no Firebase wiring).
 */

function asUidList(value) {
    return Array.isArray(value) ? value.filter((x) => typeof x === 'string' && x.length > 0) : [];
}

/**
 * @param {Record<string, unknown>|null|undefined} userA
 * @param {Record<string, unknown>|null|undefined} userB
 * @param {string} uidA
 * @param {string} uidB
 * @returns {boolean}
 */
function isMessagingRestrictedBetweenUserDocs(userA, userB, uidA, uidB) {
    if (!uidA || !uidB || uidA === uidB) return true;
    const a = userA && typeof userA === 'object' ? userA : {};
    const b = userB && typeof userB === 'object' ? userB : {};
    const aBlocked = asUidList(a.blockedUserIds);
    const aMuted = asUidList(a.mutedUserIds);
    const bBlocked = asUidList(b.blockedUserIds);
    const bMuted = asUidList(b.mutedUserIds);
    return (
        aBlocked.includes(uidB) ||
        aMuted.includes(uidB) ||
        bBlocked.includes(uidA) ||
        bMuted.includes(uidA)
    );
}

module.exports = {
    asUidList,
    isMessagingRestrictedBetweenUserDocs,
};
