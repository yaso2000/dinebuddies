import { useEffect, useState, useMemo, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkCanMessage } from '../utils/chatHelpers';

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
    const viewerProfileRef = useRef(options.viewerProfile);
    const targetProfileRef = useRef(options.targetProfile);
    viewerProfileRef.current = options.viewerProfile;
    targetProfileRef.current = options.targetProfile;

    const [canMessage, setCanMessage] = useState(false);
    const followingKey = useMemo(
        () => (Array.isArray(viewerFollowing) ? viewerFollowing.join('|') : ''),
        [viewerFollowing]
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
                let targetFollowing = Array.isArray(targetProfile?.following)
                    ? targetProfile.following
                    : null;

                if (targetFollowing == null) {
                    const snap = await getDoc(doc(db, 'users', targetUserId));
                    targetFollowing = snap.exists() ? snap.data()?.following || [] : [];
                }

                const allowed = await checkCanMessage(
                    viewerUid,
                    targetUserId,
                    viewerFollowing,
                    targetFollowing,
                    {
                        currentUserProfile: viewerProfile,
                        targetUserProfile: targetProfile,
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
    }, [viewerUid, targetUserId, followingKey, enabled, viewerFollowing]);

    return canMessage;
}
