import { useEffect, useState, useMemo, useRef } from 'react';
import { checkCanMessage } from '../utils/chatHelpers';
import { useAuth } from '../context/AuthContext';

/**
 * Whether the viewer may DM this member (dating, acquaintance, or friendship connection).
 * @param {string} viewerUid
 * @param {string} targetUserId
 * @param {string[]} [viewerFollowing]
 * @param {{
 *   enabled?: boolean,
 *   viewerProfile?: object | null,
 *   targetProfile?: object | null,
 * }} [options]
 */
export function useCanMessageMember(
    viewerUid,
    targetUserId,
    viewerFollowing = [],
    options = {}
) {
    const enabled = options.enabled !== false;
    const { userProfile } = useAuth();
    // The viewer is the current user, so their reverse follow index is their own
    // users/{uid}.followers[] — no read of the target's doc needed.
    const viewerFollowers = Array.isArray(userProfile?.followers) ? userProfile.followers : [];
    const viewerProfileRef = useRef(options.viewerProfile);
    const targetProfileRef = useRef(options.targetProfile);
    viewerProfileRef.current = options.viewerProfile || userProfile || null;
    targetProfileRef.current = options.targetProfile;

    const [canMessage, setCanMessage] = useState(false);
    const followingKey = useMemo(
        () => (Array.isArray(viewerFollowing) ? viewerFollowing.join('|') : ''),
        [viewerFollowing]
    );
    const followersKey = useMemo(
        () => viewerFollowers.join('|'),
        [viewerFollowers]
    );

    useEffect(() => {
        if (!enabled || !viewerUid || !targetUserId || viewerUid === targetUserId) {
            setCanMessage(false);
            return undefined;
        }

        let cancelled = false;
        const viewerProfile = viewerProfileRef.current;
        const targetProfile = targetProfileRef.current;

        (async () => {
            try {
                // Reverse-index path: "does target follow me?" comes from the viewer's
                // own followers[]. No read of the target's users/{uid} doc.
                const allowed = await checkCanMessage(
                    viewerUid,
                    targetUserId,
                    viewerFollowing,
                    [],
                    {
                        currentUserProfile: viewerProfile,
                        targetUserProfile: targetProfile,
                        viewerFollowers,
                    }
                );
                if (!cancelled) setCanMessage(allowed);
            } catch {
                if (!cancelled) setCanMessage(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [viewerUid, targetUserId, followingKey, followersKey, enabled, viewerFollowing, viewerFollowers]);

    return canMessage;
}
