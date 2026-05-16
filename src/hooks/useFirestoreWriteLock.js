import { useRef, useCallback } from 'react';

/**
 * Serializes Firestore / callable writes by key (e.g. per-invitation or global create).
 */
export function useFirestoreWriteLock() {
    const locksRef = useRef(new Set());
    return useCallback(async (lockKey, duplicateResult, fn) => {
        if (locksRef.current.has(lockKey)) return duplicateResult;
        locksRef.current.add(lockKey);
        try {
            return await fn();
        } finally {
            locksRef.current.delete(lockKey);
        }
    }, []);
}
