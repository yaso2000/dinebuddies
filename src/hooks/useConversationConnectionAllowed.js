import { useEffect, useMemo, useState, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { checkCanMessage } from '../utils/chatHelpers';
import { getDiscoveryLikeRef } from '../utils/discoveryProfile';
import { useAuth } from '../context/AuthContext';

const CHECK_DEBOUNCE_MS = 400;
/** The permission check awaits Firestore reads that can stall indefinitely on a
 *  bad connection. Stop blocking the screen after this; the live listeners
 *  correct the answer as soon as it arrives. */
const CHECK_WATCHDOG_MS = 6000;

/**
 * Live connection gate for 1:1 DMs — debounced to avoid spamming checks on every
 * Firestore tick. Privacy: "does the other member follow me?" is answered from the
 * viewer's OWN users/{uid}.followers[] reverse index (live via AuthContext), so this
 * never reads the target member's users/{uid} doc.
 */
export function useConversationConnectionAllowed(
    viewerUid,
    targetUserId,
    viewerFollowing = [],
    { enabled = true, isSupportPeer = false } = {}
) {
    const { userProfile } = useAuth();
    const viewerFollowers = Array.isArray(userProfile?.followers) ? userProfile.followers : [];

    const [allowed, setAllowed] = useState(isSupportPeer);
    const [loading, setLoading] = useState(Boolean(enabled && viewerUid && targetUserId && !isSupportPeer));

    // Consumers use targetProfile only as a truthiness gate + resolveConnectionKind()
    // (which returns 'friendship' regardless). Minimal shape — no target-doc read.
    const targetProfile = useMemo(() => (targetUserId ? { id: targetUserId } : null), [targetUserId]);

    // Depend on the contents, not array identity: callers build these inline with a
    // `|| []` fallback, so a fresh array each render would tear listeners down and
    // restart the debounce before it fires — leaving the chat stuck on its spinner.
    const followingKey = useMemo(
        () => (Array.isArray(viewerFollowing) ? viewerFollowing.join('|') : ''),
        [viewerFollowing]
    );
    const followersKey = useMemo(() => viewerFollowers.join('|'), [viewerFollowers]);

    const viewerFollowingRef = useRef(viewerFollowing);
    viewerFollowingRef.current = viewerFollowing;
    const viewerFollowersRef = useRef(viewerFollowers);
    viewerFollowersRef.current = viewerFollowers;
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
        const watchdog = setTimeout(() => {
            if (!cancelled) setLoading(false);
        }, CHECK_WATCHDOG_MS);

        const runCheck = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                try {
                    const ok = await checkCanMessage(
                        viewerUid,
                        targetUserId,
                        viewerFollowingRef.current,
                        [],
                        { viewerFollowers: viewerFollowersRef.current }
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

        const onListenerError = (error) => {
            console.warn('[useConversationConnectionAllowed] listener failed:', error?.code || error);
            runCheck();
        };

        // Re-check when either side toggles a discovery like (a like ref, not a users
        // doc). The follow-back signal itself arrives via viewerFollowers (deps below).
        const likeUnsubs = [
            onSnapshot(getDiscoveryLikeRef(targetUserId, viewerUid), () => runCheck(), onListenerError),
            onSnapshot(getDiscoveryLikeRef(viewerUid, targetUserId), () => runCheck(), onListenerError),
        ];

        // Nothing above is guaranteed to fire while offline — resolve rather than hang.
        runCheck();

        return () => {
            cancelled = true;
            clearTimeout(watchdog);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            likeUnsubs.forEach((unsub) => unsub());
        };
    }, [enabled, isSupportPeer, targetUserId, followingKey, followersKey, viewerUid]);

    return { allowed, loading, targetProfile };
}
