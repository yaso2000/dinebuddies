import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import StoryCircle from './StoryCircle';
import LiveStageCircle from './LiveStageCircle';
import BusinessCommunityCircle from './BusinessCommunityCircle';
import UserAvatar from './UserAvatar';
import { getSafeAvatar } from '../utils/avatarUtils';
import { mapPublicProfileDocToUserShape } from '../utils/publicProfileMap';
import { useLiveStagesDiscover } from '../hooks/useLiveStagesDiscover';
import { FaPlus, FaCamera } from 'react-icons/fa';
import { AppText } from "./base";

/** Keep "create / your story" as the first visible rail item after content loads. */
function scrollStoriesRailToStart(el) {
  if (!el) return;
  el.scrollLeft = 0;
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }
}

function isBusinessHostKind(stage) {
  return String(stage?.hostKind || 'people').toLowerCase() === 'business';
}

function sortHostFirst(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.isHost) !== Boolean(b.isHost)) return a.isHost ? -1 : 1;
    return 0;
  });
}

const StoriesBar = ({ onStoryClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, isBusiness } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myStoryData, setMyStoryData] = useState(null);
  const railRef = useRef(null);
  // Business accounts do not browse live rooms — only consumers see the rail.
  const { stages: liveStages } = useLiveStagesDiscover({
    filter: 'all',
    search: '',
    enabled: !isBusiness,
  });

  const { activeLiveStages, businessRooms } = useMemo(() => {
    if (isBusiness) {
      return { activeLiveStages: [], businessRooms: [] };
    }
    const live = (liveStages || []).filter(
      (s) => String(s?.status || 'active').toLowerCase() === 'active'
    );
    const people = [];
    const business = [];
    live.forEach((s) => {
      if (isBusinessHostKind(s)) business.push(s);
      else people.push(s);
    });
    return {
      activeLiveStages: sortHostFirst(people),
      businessRooms: sortHostFirst(business),
    };
  }, [liveStages, isBusiness]);

  // RTL + scroll-snap otherwise opens on the last circle and hides create/your story.
  useEffect(() => {
    const el = railRef.current;
    if (!el || loading) return undefined;
    scrollStoriesRailToStart(el);
    const id = window.requestAnimationFrame(() => scrollStoriesRailToStart(el));
    return () => window.cancelAnimationFrame(id);
  }, [
    loading,
    myStoryData?.userId,
    activeLiveStages.length,
    businessRooms.length,
    stories.length,
  ]);

  // Robust user photo retrieval
  const userPhoto = getSafeAvatar(userProfile || currentUser);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
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
        map((doc) => ({ id: doc.id, ...doc.data() })).
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

          const views = story.views || [];
          if (currentUser?.uid && !views.includes(currentUser.uid)) {
            userStoriesMap[storyOwnerId].hasNewActiveStory = true;
          }
        });

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
            // Let's show them to be safe, or hide to be clean?
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
  }, [currentUser, userPhoto]);

  // Keep the rail visible when rooms exist even if stories are still loading.
  if (loading && activeLiveStages.length === 0 && businessRooms.length === 0 && stories.length === 0) return null;

  return (
    <div style={{
      background: 'transparent',
      borderBottom: 'none',
      padding: '6px 0',
      marginBottom: '0.5rem',
      // Removed sticky to avoid transparency overlap issues
      position: 'relative',
      zIndex: 10
    }}>
            <div
        ref={railRef}
        dir="ltr"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '12px',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x proximity',
          scrollPaddingInline: '16px',
          /* Extra bottom padding so LIVE badges on stage circles are not clipped */
          padding: '4px 16px 12px',
          touchAction: 'pan-x',
        }}
        className="hide-scrollbar stories-bar__rail"
        role="list"
        aria-label={t('stories_and_live_rail', 'Stories and live rooms')}
      >
        
                {/*
             Order (always start of rail): Create/Your Story → Live Stages → Business Stages → Other stories
             dir=ltr keeps create first visible; RTL page dir otherwise scrolls to the end.
          */}

                {myStoryData ?
        <>
                        {/* 1. Add Story Button — first snap / first visible */}
                        <div
            role="listitem"
            onClick={() => navigate('/create-story')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0,
              scrollSnapAlign: 'start',
            }}>
            
                            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'var(--bg-body)',
              border: '2px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', color: 'var(--text-primary)'
            }}>
                                <FaCamera />
                            </div>
                            <AppText as="span" style={{ fontSize: '0.75rem', maxWidth: '75px', textAlign: 'center', color: 'var(--text-main)' }}>
                                {t('new', { defaultValue: 'New' })}
                            </AppText>
                        </div>

                        {/* 2. My Story (View) */}
                        <div
            role="listitem"
            onClick={() => onStoryClick({
              allUserStories: [myStoryData, ...stories],
              initialUserIndex: 0
            })}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0,
              scrollSnapAlign: 'start',
            }}>
            
                            <div className="avatar-story-ring avatar-story-ring--own">
                                <UserAvatar
                user={userProfile || currentUser}
                src={userPhoto}
                alt={t('your_story', { defaultValue: 'Your Story' })}
                style={{ width: 64, height: 64 }} />
              
                            </div>
                            <AppText as="span" style={{ fontSize: '0.75rem', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', color: 'var(--text-main)' }}>
                                {t('your_story', { defaultValue: 'Your Story' })}
                            </AppText>
                        </div>
                    </> : (

        /* Create Mode — first item */
        <div
          role="listitem"
          onClick={() => navigate('/create-story')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0, position: 'relative',
            scrollSnapAlign: 'start',
          }}>
          
                        <div style={{ position: 'relative', lineHeight: 0 }}>
                            <UserAvatar
              user={userProfile || currentUser}
              src={userPhoto}
              alt={t('your_story', { defaultValue: 'Your Story' })}
              style={{ width: 64, height: 64 }} />
            
                            <div style={{
              position: 'absolute', bottom: '0', right: '0',
              background: '#1d9bf0', color: 'white',
              width: '22px', height: '22px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg-card)', fontSize: '10px'
            }}>
                                <FaPlus />
                            </div>
                        </div>
                        <AppText as="span" style={{ fontSize: '0.75rem', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', color: 'var(--text-main)' }}>
                            {t('your_story', { defaultValue: 'Your Story' })}
                        </AppText>
                    </div>)
        }

                {/* Live consumer Stages (active only) */}
                {activeLiveStages.map((stage) => (
                  <div key={`live-${stage.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <LiveStageCircle
                      stage={stage}
                      onClick={() => navigate(`/stage/${stage.id}`)}
                    />
                  </div>
                ))}

                {/* Live business Stages (24h, then purged — same as people) */}
                {businessRooms.map((stage) => (
                  <div
                    key={`biz-${stage.id}`}
                    role="listitem"
                    style={{ scrollSnapAlign: 'start', flexShrink: 0 }}
                  >
                    <BusinessCommunityCircle
                      community={{
                        id: stage.id,
                        name: stage.title || stage.hostName,
                        logo: stage.hostAvatar,
                      }}
                      live
                      onClick={() => navigate(`/stage/${stage.id}`)}
                    />
                  </div>
                ))}

                {/* Other Users' Stories */}
                {stories.map((user, index) =>
        <div key={user.userId} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
        <StoryCircle
          partner={{
            id: user.userId,
            name: user.partnerName,
            logo: user.partnerLogo,
            gender: user.partnerGender
          }}
          hasNewStory={user.hasNewActiveStory}
          onClick={() => onStoryClick({
            allUserStories: myStoryData ? [myStoryData, ...stories] : stories,
            initialUserIndex: myStoryData ? index + 1 : index
          })} />
        </div>

        )}
            </div>

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>);

};

export default StoriesBar;