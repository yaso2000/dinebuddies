import { useEffect, useMemo, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkCanMessage } from '../utils/chatHelpers';
import { getDiscoveryLikeRef } from '../utils/discoveryProfile';

const CHECK_DEBOUNCE_MS = 400;
/** The permission check awaits Firestore reads that can stall indefinitely on a
 *  bad connection. Stop blocking the screen after this; the live listeners
 *  correct the answer as soon as it arrives. */
const CHECK_WATCHDOG_MS = 6000;

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
    const [targetProfile, setTargetProfile] = useState(null);

    // Depend on the contents, not the array identity: callers build this list
    // inline with a `|| []` fallback, so a fresh empty array on every render
    // would tear the listeners down and restart the debounce before it could
    // ever fire — leaving the chat on its loading screen for good.
    const followingKey = useMemo(
        () => (Array.isArray(viewerFollowing) ? viewerFollowing.join('|') : ''),
        [viewerFollowing]
    );
    const viewerFollowingRef = useRef(viewerFollowing);
    viewerFollowingRef.current = viewerFollowing;

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

        // Every listener needs an error handler: onSnapshot without one dies
        // silently on a denied or dropped read, and `loading` would never be
        // cleared — the chat would sit on its spinner with nothing to retry.
        const onListenerError = (error) => {
            console.warn('[useConversationConnectionAllowed] listener failed:', error?.code || error);
            runCheck();
        };

        const userUnsub = onSnapshot(
            doc(db, 'users', targetUserId),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    targetFollowingRef.current = Array.isArray(data?.following) ? data.following : [];
                    targetProfileRef.current = { id: targetUserId, ...data };
                } else {
                    targetFollowingRef.current = [];
                    targetProfileRef.current = { id: targetUserId };
                }
                if (!cancelled) setTargetProfile(targetProfileRef.current);
                runCheck();
            },
            onListenerError
        );

        const onLikeChange = () => runCheck();

        const likeUnsubs = [
            onSnapshot(getDiscoveryLikeRef(targetUserId, viewerUid), onLikeChange, onListenerError),
            onSnapshot(getDiscoveryLikeRef(viewerUid, targetUserId), onLikeChange, onListenerError),
        ];

        // Nothing above is guaranteed to fire — a listener can simply never call
        // back while offline. Resolve the gate rather than hang on it.
        runCheck();

        return () => {
            cancelled = true;
            clearTimeout(watchdog);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            userUnsub();
            likeUnsubs.forEach((unsub) => unsub());
        };
    }, [enabled, isSupportPeer, targetUserId, followingKey, viewerUid]);

    return { allowed, loading, targetProfile };
}
