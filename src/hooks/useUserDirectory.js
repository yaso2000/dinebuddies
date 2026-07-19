import { useCallback, useEffect, useRef, useState } from 'react';
import { searchAccounts } from '../services/accountSearch';
import {
    enrichDirectorySearchResults,
    fetchUserDirectoryPage,
    USER_DIRECTORY_PAGE_SIZE,
} from '../utils/userDirectory';
import { isExcludedDirectoryUser } from '../utils/consumerSearchExclusions';

const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Browse + search hook for the users directory.
 */
export function useUserDirectory({
    excludeUid,
    enabled = true,
    pageSize = USER_DIRECTORY_PAGE_SIZE,
} = {}) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [hasMore, setHasMore] = useState(false);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);

    const lastDocRef = useRef(null);
    const requestIdRef = useRef(0);
    const searchRequestIdRef = useRef(0);

    const term = query.trim();
    const isSearchMode = term.length >= MIN_SEARCH_CHARS;

    const loadBrowse = useCallback(
        async ({ reset = false } = {}) => {
            if (!enabled) return;
            const requestId = ++requestIdRef.current;

            if (reset) {
                setLoading(true);
                setError('');
                lastDocRef.current = null;
            } else {
                setLoadingMore(true);
            }

            try {
                const result = await fetchUserDirectoryPage({
                    excludeUid,
                    pageSize,
                    lastDoc: reset ? null : lastDocRef.current,
                });
                if (requestId !== requestIdRef.current) return;

                lastDocRef.current = result.lastDoc;
                setHasMore(result.hasMore);
                setUsers((prev) =>
                    (reset ? result.users : [...prev, ...result.users]).filter(
                        (u) => !isExcludedDirectoryUser(u)
                    )
                );
            } catch (err) {
                console.error('[useUserDirectory] browse', err);
                if (requestId === requestIdRef.current) {
                    setError('user_directory_load_error');
                    if (reset) setUsers([]);
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        [enabled, excludeUid, pageSize]
    );

    useEffect(() => {
        if (!enabled) {
            setUsers([]);
            setHasMore(false);
            return;
        }

        if (isSearchMode) return undefined;

        loadBrowse({ reset: true });
        return () => {
            requestIdRef.current += 1;
        };
    }, [enabled, isSearchMode, loadBrowse]);

    useEffect(() => {
        if (!enabled || !isSearchMode) {
            setSearching(false);
            return undefined;
        }

        const requestId = ++searchRequestIdRef.current;
        setSearching(true);
        setError('');

        const timer = window.setTimeout(async () => {
            try {
                const result = await searchAccounts(term);
                if (requestId !== searchRequestIdRef.current) return;
                const enriched = await enrichDirectorySearchResults(result.users || []);
                if (requestId !== searchRequestIdRef.current) return;
                const filtered = excludeUid
                    ? enriched.filter((u) => u.id !== excludeUid && !isExcludedDirectoryUser(u))
                    : enriched.filter((u) => !isExcludedDirectoryUser(u));
                setUsers(filtered);
                setHasMore(false);
            } catch (err) {
                console.error('[useUserDirectory] search', err);
                if (requestId === searchRequestIdRef.current) {
                    setUsers([]);
                    setError('user_directory_search_error');
                }
            } finally {
                if (requestId === searchRequestIdRef.current) setSearching(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [enabled, excludeUid, isSearchMode, term]);

    const loadMore = useCallback(() => {
        if (!enabled || isSearchMode || loading || loadingMore || !hasMore) return;
        loadBrowse({ reset: false });
    }, [enabled, hasMore, isSearchMode, loadBrowse, loading, loadingMore]);

    const runSearch = useCallback(async () => {
        if (!enabled || !isSearchMode) return;
        const requestId = ++searchRequestIdRef.current;
        setSearching(true);
        setError('');
        try {
            const result = await searchAccounts(term);
            if (requestId !== searchRequestIdRef.current) return;
            const enriched = await enrichDirectorySearchResults(result.users || []);
            if (requestId !== searchRequestIdRef.current) return;
            const filtered = excludeUid
                ? enriched.filter((u) => u.id !== excludeUid && !isExcludedDirectoryUser(u))
                : enriched.filter((u) => !isExcludedDirectoryUser(u));
            setUsers(filtered);
            setHasMore(false);
        } catch (err) {
            console.error('[useUserDirectory] search', err);
            if (requestId === searchRequestIdRef.current) {
                setUsers([]);
                setError('user_directory_search_error');
            }
        } finally {
            if (requestId === searchRequestIdRef.current) setSearching(false);
        }
    }, [enabled, excludeUid, isSearchMode, term]);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        if (isSearchMode) {
            await runSearch();
            return;
        }
        await loadBrowse({ reset: true });
    }, [enabled, isSearchMode, loadBrowse, runSearch]);

    return {
        users,
        loading: loading || searching,
        loadingMore,
        error,
        hasMore: !isSearchMode && hasMore,
        query,
        setQuery,
        isSearchMode,
        loadMore,
        refresh,
        minSearchChars: MIN_SEARCH_CHARS,
    };
}
