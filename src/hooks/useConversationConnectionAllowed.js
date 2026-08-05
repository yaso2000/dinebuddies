import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkCanMessage } from '../utils/chatHelpers';
import { getDiscoveryLikeRef } from '../utils/discoveryProfile';

const CHECK_DEBOUNCE_MS = 400;

/**
 * Live connection gate for 1:1 DMs — debounced to avoid spamming checks on every Firestore tick.
 */
export function useConversationConnectionAllowed(
    viewerUid,
    targetUserId,
    viewerFollowing = [],
    { enabled = true, isSupportPeer = false } = {}
) {
    const [allowed, setAllowed] = useState(isSupportPeer);
    const [loading, setLoading] = useState(Boolean(enabled && viewerUid && targetUserId && !isSupportPeer));

    const targetFollowingRef = useRef([]);
    const targetProfileRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!enabled || !viewerUid || !targetUserId) {
            setAllowed(false);
            setLoading(false);
            return undefined;
        }

        if (isSupportPeer) {
            setAllowed(true);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;

        const runCheck = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                try {
                    const ok = await checkCanMessage(
                        viewerUid,
                        targetUserId,
                        viewerFollowing,
                        targetFollowingRef.current,
                        { targetUserProfile: targetProfileRef.current }
                    );
                    if (!cancelled) {
                        setAllowed(ok);
                        setLoading(false);
                    }
                } catch {
                    if (!cancelled) {
                        setAllowed(false);
                        setLoading(false);
                    }
                }
            }, CHECK_DEBOUNCE_MS);
        };

        const userUnsub = onSnapshot(doc(db, 'users', targetUserId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                targetFollowingRef.current = Array.isArray(data?.following) ? data.following : [];
                targetProfileRef.current = { id: targetUserId, ...data };
            } else {
                targetFollowingRef.current = [];
                targetProfileRef.current = { id: targetUserId };
            }
            runCheck();
        });

        const onLikeChange = () => runCheck();

        const likeUnsubs = [
            onSnapshot(getDiscoveryLikeRef(targetUserId, viewerUid), onLikeChange),
            onSnapshot(getDiscoveryLikeRef(viewerUid, targetUserId), onLikeChange),
        ];

        return () => {
            cancelled = true;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            userUnsub();
            likeUnsubs.forEach((unsub) => unsub());
        };
    }, [enabled, isSupportPeer, targetUserId, viewerFollowing, viewerUid]);

    return { allowed, loading };
}
