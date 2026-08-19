import { useEffect, useState } from 'react';
import { collection, query, where, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import { mapPublicProfileDocToUserShape } from '../utils/publicProfileMap';

/** A user's story tray is one continuous timeline: (createdAt, order) ascending.
 * `order` only exists on items posted together in one multi-item session — legacy
 * single-item docs default to 0, which is correct since they have nothing to tie-break against. */
export function compareStoryOrder(a, b) {
  const toMs = (ts) => {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
  };
  const aMs = toMs(a.createdAt);
  const bMs = toMs(b.createdAt);
  if (aMs !== bMs) return aMs - bMs;
  return (a.order || 0) - (b.order || 0);
}

/** `views` moved from an array (legacy docs) to a `{uid: timestamp}` map — support both shapes. */
export function hasViewerSeenStory(story, uid) {
  if (!uid) return false;
  const views = story?.views;
  if (Array.isArray(views)) return views.includes(uid);
  return Boolean(views && views[uid]);
}

/**
 * Live subscription to active (non-expired) stories, grouped per user into trays and
 * sorted chronologically, with the current viewer's own stories split out separately.
 * Shared by StoriesBar (rail) and any future consumer that needs the same grouping
 * (profile pages, Highlights) without re-deriving it from the raw Firestore query.
 *
 * @param {{uid: string}|null} currentUser
 * @param {string} userPhoto — fallback avatar for the viewer's own tray
 * @returns {{ stories: Array, myStoryData: Object|null, loading: boolean }}
 */
export function useStories(currentUser, userPhoto) {
  const [stories, setStories] = useState([]);
  const [myStoryData, setMyStoryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return undefined;
    }

    const now = new Date();

    // Real-time listener for stories — limit + filter non-expired to reduce reads
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', now),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        // Filter and sort client-side
        const activeStories = snapshot.docs.
        map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).
        filter((story) => {
          // Check if expired
          const expiresAt = story.expiresAt;
          if (expiresAt) {
            const expiryDate = typeof expiresAt.toDate === 'function' ? expiresAt.toDate() : new Date(expiresAt);
            // Compare timestamps for accuracy
            if (expiryDate.getTime() <= Date.now()) return false;
          }
          return true;
        });

        // Separate My Stories vs Others
        const myStories = [];
        const userStoriesMap = {};

        activeStories.forEach((story) => {
          // ROBUST ID CHECK: Check all possible field names
          const storyOwnerId = story.userId || story.uid || story.authorId || story.author?.id;

          // If no ID found, we can't attribute it. Skip it.
          if (!storyOwnerId) return;

          // Check if it's my story (String comparison for safety)
          if (currentUser?.uid && String(storyOwnerId) === String(currentUser.uid)) {
            myStories.push(story);
            return; // Don't add to general map
          }

          if (!userStoriesMap[storyOwnerId]) {
            userStoriesMap[storyOwnerId] = {
              userId: storyOwnerId,
              partnerName: story.userName || story.author?.name, // Can be undefined/null initially
              partnerLogo: getSafeAvatar(story.author || story),
              stories: [],
              hasNewActiveStory: false
            };
          }

          userStoriesMap[storyOwnerId].stories.push(story);

          if (currentUser?.uid && !hasViewerSeenStory(story, currentUser.uid)) {
            userStoriesMap[storyOwnerId].hasNewActiveStory = true;
          }
        });

        // Each user's tray is one continuous, chronologically-ordered timeline.
        Object.values(userStoriesMap).forEach((group) => {
          group.stories.sort(compareStoryOrder);
        });
        myStories.sort(compareStoryOrder);

        // --- DEEP FIX: Fetch missing profiles ---
        const userIdsToFetch = Object.values(userStoriesMap).
        filter((u) => !u.partnerName || u.partnerName === 'User').
        map((u) => u.userId);

        const uniqueIdsToFetch = [...new Set(userIdsToFetch)];

        // Helper to finalize and set state
        const setFinalStories = (fetchedProfiles = {}) => {
          const processedStories = Object.values(userStoriesMap).
          map((userGroup) => {
            // If we requested a profile fetch for this user (because data was missing/generic)
            // AND the profile wasn't found in DB -> It's likely a deleted/dummy user.
            if (uniqueIdsToFetch.includes(userGroup.userId) && !fetchedProfiles[userGroup.userId]) {
              return null; // Filter out orphan stories
            }

            const profile = fetchedProfiles[userGroup.userId];
            if (profile) {
              // STRICT FILTER: No guests, no generic 'User' with dummy avatars
              if (profile.isGuest || profile.role === 'guest') return null;

              const pName = profile.displayName || profile.name || profile.businessInfo?.businessName || userGroup.partnerName || 'User';
              const pLogo = getSafeAvatar(profile);

              // Filter out "User" if they have a cartoon/default avatar (likely unconfigured/dummy account)
              if (pName === 'User' && (String(pLogo).includes('dicebear') || !pLogo)) {
                return null;
              }

              return {
                ...userGroup,
                partnerName: pName,
                partnerLogo: pLogo,
                partnerGender: profile.gender
              };
            }

            // If we didn't need to fetch (data was in story), keep it.
            // BUT check if it looks like a guest/dummy
            let currentName = userGroup.partnerName || 'User';
            // Safe check for logo string
            let currentLogoStr = String(userGroup.partnerLogo || '');

            if (currentName === 'User' && (currentLogoStr.includes('dicebear') || !userGroup.partnerLogo)) {
              return null;
            }

            if (!userGroup.partnerName) userGroup.partnerName = 'User';
            return userGroup;
          }).
          filter(Boolean); // Remove nulls (orphans)

          // Convert to array and sort (unviewed first)
          const sortedStories = processedStories.sort((a, b) => {
            if (a.hasNewActiveStory && !b.hasNewActiveStory) return -1;
            if (!a.hasNewActiveStory && b.hasNewActiveStory) return 1;
            return 0;
          });

          setStories(sortedStories);
          setLoading(false);
        };

        if (uniqueIdsToFetch.length > 0) {
          try {
            // public_profiles is readable by everyone; users/{id} is not (guests).
            const fetchPromises = uniqueIdsToFetch.map((id) => getDoc(doc(db, 'public_profiles', id)));
            const snapshots = await Promise.all(fetchPromises);
            const profilesMap = {};
            snapshots.forEach((snap) => {
              if (snap.exists()) {
                const mapped = mapPublicProfileDocToUserShape(snap.data());
                if (mapped) profilesMap[snap.id] = mapped;
              }
            });
            setFinalStories(profilesMap);
          } catch (err) {
            console.error("Error fetching missing profiles:", err);
            // In case of error (e.g. network), we might show them as is, or hide.
            // Safety: show old behavior if fetch fails completely
            setStories(Object.values(userStoriesMap));
            setLoading(false);
          }
        } else {
          setFinalStories();
        }

        // Set My Story Data
        if (myStories.length > 0) {
          setMyStoryData({
            userId: currentUser?.uid,
            partnerName: 'You',
            partnerLogo: userPhoto,
            stories: myStories,
            hasNewActiveStory: false
          });
        } else {
          setMyStoryData(null);
        }

      } catch (error) {
        console.error("Error processing stories:", error);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching stories:", error);
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userPhoto]);

  return { stories, myStoryData, loading };
}
