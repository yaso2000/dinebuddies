import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkCanMessage } from '../utils/chatHelpers';

/**
 * Whether the viewer may DM this member (dating, acquaintance, or friendship connection).
 */
export function useCanMessageMember(viewerUid, targetUserId, viewerFollowing = []) {
    const [canMessage, setCanMessage] = useState(false);
    const followingKey = useMemo(
        () => (Array.isArray(viewerFollowing) ? viewerFollowing.join('|') : ''),
        [viewerFollowing]
    );

    useEffect(() => {
        if (!viewerUid || !targetUserId || viewerUid === targetUserId) {
            setCanMessage(false);
            return undefined;
        }

        let cancelled = false;

        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', targetUserId));
                const targetFollowing = snap.exists() ? snap.data()?.following || [] : [];
                const allowed = await checkCanMessage(
                    viewerUid,
                    targetUserId,
                    viewerFollowing,
                    targetFollowing
                );
                if (!cancelled) setCanMessage(allowed);
            } catch {
                if (!cancelled) setCanMessage(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [viewerUid, targetUserId, followingKey]);

    return canMessage;
}
