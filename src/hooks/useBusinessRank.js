import { useState, useEffect } from 'react';
import { loadRankedEliteBusinesses } from '../services/rankingDataLoader';

const MAX_LIST = 200;

/**
 * Returns the rank of a business among Elite businesses (1-based). Used on business profile.
 * @param {string|null} profileId - business user id
 * @returns {{ loading: boolean, rank: number|null, totalElite: number }}
 */
export function useBusinessRank(profileId) {
    const [loading, setLoading] = useState(true);
    const [rank, setRank] = useState(null);
    const [totalElite, setTotalElite] = useState(0);

    useEffect(() => {
        if (!profileId) {
            setLoading(false);
            setRank(null);
            setTotalElite(0);
            return;
        }
        let cancelled = false;
        setLoading(true);
        loadRankedEliteBusinesses({ limit: MAX_LIST })
            .then(list => {
                if (cancelled) return;
                setTotalElite(list.length);
                const idx = list.findIndex(b => (b.id || b.uid) === profileId);
                setRank(idx >= 0 ? idx + 1 : null);
            })
            .catch(() => {
                if (!cancelled) setRank(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [profileId]);

    return { loading, rank, totalElite };
}
