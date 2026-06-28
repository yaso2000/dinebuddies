import { useEffect, useState } from 'react';
import { getDiscoveryActionStatus, peekDiscoveryActionStatus } from '../utils/discoveryProfile';

/**
 * Preload like / daily-greeting limits — stays in sync after like/unlike via cache events.
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

        const onCacheUpdate = (event) => {
            const detail = event?.detail;
            if (!detail || detail.viewerId !== viewerUid || detail.targetId !== targetId) return;
            setStatus((prev) => ({
                liked: detail.liked ?? prev.liked,
                greetedToday: detail.greetedToday ?? prev.greetedToday,
                loading: false,
            }));
        };

        window.addEventListener('discovery-action-status', onCacheUpdate);

        let cancelled = false;

        getDiscoveryActionStatus(viewerUid, targetId)
            .then((next) => {
                if (!cancelled) {
                    const peek = peekDiscoveryActionStatus(viewerUid, targetId);
                    setStatus({
                        liked: peek?.liked ?? next.liked,
                        greetedToday: peek?.greetedToday ?? next.greetedToday,
                        loading: false,
                    });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus((prev) => ({ ...prev, loading: false }));
                }
            });

        return () => {
            cancelled = true;
            window.removeEventListener('discovery-action-status', onCacheUpdate);
        };
    }, [viewerUid, targetId]);

    return status;
}
