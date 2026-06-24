/**
 * Profile section visibility — invitation history & friends (mutual follows).
 * Demo users always hide both from other viewers.
 */

function ownerUid(user) {
    return String(user?.uid || user?.id || '').trim();
}

export function isProfileInvitationHistoryPublic(user) {
    if (user?.isDemo === true) return false;
    return user?.privacySettings?.showInvitationHistory !== false;
}

export function isProfileFriendsPublic(user) {
    if (user?.isDemo === true) return false;
    return user?.privacySettings?.showFriends !== false;
}

export function canViewerSeeProfileInvitationHistory(user, viewerUid) {
    const uid = ownerUid(user);
    if (uid && viewerUid && uid === viewerUid) return true;
    return isProfileInvitationHistoryPublic(user);
}

export function canViewerSeeProfileFriends(user, viewerUid) {
    const uid = ownerUid(user);
    if (uid && viewerUid && uid === viewerUid) return true;
    return isProfileFriendsPublic(user);
}
