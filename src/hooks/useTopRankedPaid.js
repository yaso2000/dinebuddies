import { useState, useEffect, useRef } from 'react';
import { loadRankedPaidBusinesses } from '../services/rankingDataLoader';

/** Top N Paid Business accounts (sidebar ranking) — fetched once per page load. */
export function useTopRankedPaid(limit = 3) {
    const [loading, setLoading] = useState(true);
    const [top, setTop] = useState([]);
    const [error, setError] = useState(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return undefined;
        fetchedRef.current = true;

        let cancelled = false;
        setLoading(true);
        setError(null);

        loadRankedPaidBusinesses({ limit })
            .then((list) => {
                if (!cancelled) setTop(list || []);
            })
            .catch((e) => {
                if (!cancelled) {
                    setError(e);
                    setTop([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [limit]);

    return { loading, top, error };
}
