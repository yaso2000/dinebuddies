import { useState, useEffect } from 'react';
import { loadRankedEliteBusinesses } from '../services/rankingDataLoader';

/**
 * Returns top N Elite-ranked businesses (for sidebar).
 * @param {number} limit - default 3
 * @returns {{ loading: boolean, top: Array, error: Error|null }}
 */
export function useTopRankedElite(limit = 3) {
    const [loading, setLoading] = useState(true);
    const [top, setTop] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        loadRankedEliteBusinesses({ limit })
            .then(list => {
                if (!cancelled) setTop(list || []);
            })
            .catch(e => {
                if (!cancelled) {
                    setError(e);
                    setTop([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [limit]);

    return { loading, top, error };
}
