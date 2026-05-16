/**
 * Shared rules for the small "+" follow badge on profile avatars.
 * Badge is gray when the viewer cannot follow (guest / target disabled follows).
 */

export function resolveFollowPlusBadge({ subjectUser = {}, subjectId, viewerUser, viewerProfile }) {
    const sid = subjectId || subjectUser?.id || subjectUser?.uid;
    const viewerId = viewerUser?.uid || viewerUser?.id;
    if (!sid || !viewerId) return { show: false, disabled: false };
    if (sid === viewerId) return { show: false, disabled: false };

    const viewerRole = viewerProfile?.role || viewerUser?.role;
    if (viewerRole === 'business') return { show: false, disabled: false };

    const sub = subjectUser || {};
    if (sub.role === 'business' || sub.isBusiness === true || sub.partnerId) return { show: false, disabled: false };

    const following = Array.isArray(viewerProfile?.following)
        ? viewerProfile.following
        : Array.isArray(viewerUser?.following)
          ? viewerUser.following
          : [];

    let isFollowingSubject = following.includes(sid);
    if (typeof sub.isFollowedByMe === 'boolean') {
        isFollowingSubject = sub.isFollowedByMe;
    }
    if (isFollowingSubject) return { show: false, disabled: false };

    const viewerIsGuest = !!(viewerProfile?.isGuest || viewerUser?.isGuest);
    const allowFollowing = sub.privacySettings?.allowFollowing !== false;
    const disabled = viewerIsGuest || !allowFollowing;

    return { show: true, disabled };
}

/**
 * @param {object} subjectUser — must include id/uid when possible; optional isFollowedByMe, privacySettings
 * @param {{ currentUser: object, userProfile: object, toggleFollow: function, showToast: function, t: function }} ctx
 * @returns {null | { show: true, disabled: boolean, onClick: (e: Event) => void }}
 */
export function buildFollowPlusProps(subjectUser, ctx) {
    const { currentUser, userProfile, toggleFollow, showToast, t } = ctx || {};
    if (!toggleFollow || !currentUser) return null;

    const resolved = resolveFollowPlusBadge({
        subjectUser,
        subjectId: subjectUser?.id || subjectUser?.uid,
        viewerUser: currentUser,
        viewerProfile: userProfile,
    });
    if (!resolved.show) return null;

    const sid = subjectUser?.id || subjectUser?.uid;
    return {
        show: true,
        disabled: resolved.disabled,
        onClick: (e) => {
            e.stopPropagation();
            if (resolved.disabled) {
                if (userProfile?.isGuest || currentUser?.isGuest) {
                    showToast?.(
                        t?.('login_to_follow', { defaultValue: 'Sign in to follow users.' }) || 'Sign in to follow.',
                        'info'
                    );
                } else {
                    showToast?.(
                        t?.('following_disabled', { defaultValue: 'This user has disabled follows.' }) ||
                            'Following is disabled.',
                        'info'
                    );
                }
                return;
            }
            toggleFollow(sid);
        },
    };
}
