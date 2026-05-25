import { useEffect, useState } from 'react';
import { asUidArray } from '../utils/userSocialLists';
import { buildFeedAudienceGraph } from '../utils/feedSocialGraph';

const EMPTY_GRAPH = {
    followingSet: new Set(),
    mutualSet: new Set(),
    fofSet: new Set(),
    viewerInterests: [],
};

/**
 * Loads follower / mutual / friends-of-friends sets for feed ranking.
 */
export default function useFeedAudienceGraph(currentUser, userProfile) {
    const [graph, setGraph] = useState(EMPTY_GRAPH);
    const [loading, setLoading] = useState(true);

    const followingKey = asUidArray(userProfile?.following).join(',');

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) {
            setGraph(EMPTY_GRAPH);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);

        (async () => {
            const followingIds = asUidArray(userProfile?.following);
            const viewerInterests = userProfile?.interests || userProfile?.hobbies || [];
            try {
                const built = await buildFeedAudienceGraph(uid, followingIds, viewerInterests);
                if (!cancelled) setGraph(built);
            } catch (e) {
                console.warn('[useFeedAudienceGraph]', e);
                if (!cancelled) setGraph(EMPTY_GRAPH);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentUser?.uid, followingKey, userProfile?.interests, userProfile?.hobbies]);

    return { graph, loading };
}
