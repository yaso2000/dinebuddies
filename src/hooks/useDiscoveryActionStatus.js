import { useEffect, useState } from 'react';
import { getDiscoveryActionStatus, peekDiscoveryActionStatus } from '../utils/discoveryProfile';

/**
 * Preload like / daily-greeting limits — buttons stay enabled unless cache says already used.
 */
export function useDiscoveryActionStatus(viewerUid, targetId) {
    const cached = peekDiscoveryActionStatus(viewerUid, targetId);

    const [status, setStatus] = useState({
        liked: cached?.liked ?? false,
        greetedToday: cached?.greetedToday ?? false,
        loading: false,
    });

    useEffect(() => {
        if (!viewerUid || !targetId || viewerUid === targetId) {
            setStatus({ liked: false, greetedToday: false, loading: false });
            return undefined;
        }

        let cancelled = false;

        getDiscoveryActionStatus(viewerUid, targetId)
            .then((next) => {
                if (!cancelled) {
                    setStatus({ liked: next.liked, greetedToday: next.greetedToday, loading: false });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus((prev) => ({ ...prev, loading: false }));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [viewerUid, targetId]);

    return status;
}
