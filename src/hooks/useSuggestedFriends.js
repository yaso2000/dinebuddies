import { useEffect, useRef, useState } from 'react';
import { fetchUserDirectoryPage } from '../utils/userDirectory';
import {
    buildSuggestedFriendViewerProfile,
    pickSuggestedFriends,
} from '../utils/suggestedFriendsMatch';

const BROWSE_PAGES = 3;
const PAGE_SIZE = 24;
const SUGGESTED_LIMIT = 4;

/**
 * Sidebar suggested friends — fetched once per page load when profile is ready.
 */
export function useSuggestedFriends({ userProfile, currentUser, enabled = true }) {
    const [loading, setLoading] = useState(false);
    const [suggested, setSuggested] = useState([]);
    const fetchedRef = useRef(false);

    const uid = currentUser?.uid || currentUser?.id;

    useEffect(() => {
        if (!enabled || !uid || !userProfile || fetchedRef.current) return undefined;

        fetchedRef.current = true;
        let cancelled = false;
        setLoading(true);

        const viewer = buildSuggestedFriendViewerProfile(userProfile, currentUser);

        (async () => {
            try {
                const pool = [];
                let lastDoc = null;

                for (let page = 0; page < BROWSE_PAGES; page += 1) {
                    const result = await fetchUserDirectoryPage({
                        excludeUid: uid,
                        pageSize: PAGE_SIZE,
                        lastDoc,
                    });
                    pool.push(...(result.users || []));
                    lastDoc = result.lastDoc;
                    if (!result.hasMore) break;
                }

                if (cancelled) return;

                const following = new Set([
                    ...(viewer.following || []),
                    uid,
                ].filter(Boolean));

                setSuggested(
                    pickSuggestedFriends(pool, viewer, {
                        limit: SUGGESTED_LIMIT,
                        excludeIds: following,
                    })
                );
            } catch (err) {
                console.warn('[useSuggestedFriends]', err);
                if (!cancelled) setSuggested([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, uid, userProfile?.id]);

    return { loading, suggested };
}
