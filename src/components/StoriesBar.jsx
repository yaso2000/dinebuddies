import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import StoryCircle from './StoryCircle';
import LiveStageCircle from './LiveStageCircle';
import LiveGameCircle from './LiveGameCircle';
import { useLiveGamesDiscover } from '../hooks/useLiveGamesDiscover';
import SuitabilityCircle from './SuitabilityCircle';
import { useLiveSuitabilityPosts } from '../hooks/useLiveSuitabilityPosts';
import RealOrAiCircle from './RealOrAiCircle';
import { useLiveRealOrAiPosts } from '../hooks/useLiveRealOrAiPosts';
import { useMyLiveRealOrAiPost } from '../hooks/useMyLiveRealOrAiPost';
import ZodiacCircle from './ZodiacCircle';
import { useLiveZodiacPosts } from '../hooks/useLiveZodiacPosts';
import { useMyLiveZodiacPost } from '../hooks/useMyLiveZodiacPost';
import BusinessCommunityCircle from './BusinessCommunityCircle';
import UserAvatar from './UserAvatar';
import { getSafeAvatar } from '../utils/avatarUtils';
import { useStories } from '../hooks/useStories';
import { useLiveStagesDiscover } from '../hooks/useLiveStagesDiscover';
import { useMyLiveStage } from '../hooks/useMyLiveStage';
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
  // Robust user photo retrieval
  const userPhoto = getSafeAvatar(userProfile || currentUser);
  const { stories, myStoryData, loading } = useStories(currentUser, userPhoto);
  const railRef = useRef(null);
  // Business accounts do not browse live rooms — only consumers see the rail.
  const { stages: liveStages } = useLiveStagesDiscover({
    filter: 'all',
    search: '',
    enabled: !isBusiness,
  });
  // Live group games are open to everyone (consumers only browse the rail).
  const { games: liveGames } = useLiveGamesDiscover({ enabled: !isBusiness });
  // Live "Who suits you?" polls — prominent at the front of the rail.
  const { posts: suitabilityPosts } = useLiveSuitabilityPosts({ enabled: !isBusiness });
  // Live "Camera or AI?" rounds — prominent at the front of the rail.
  const { posts: realOrAiPosts } = useLiveRealOrAiPosts({ enabled: !isBusiness });
  // The viewer's OWN live card (never in the guessing deck) — a dedicated entry
  // so the owner can see results + end the round. "Publish = enter" lands here.
  const { post: myRealOrAiCard } = useMyLiveRealOrAiPost();
  // Live "Guess my sign?" cards + the viewer's own.
  const { posts: zodiacPosts } = useLiveZodiacPosts({ enabled: !isBusiness });
  const { post: myZodiacCard } = useMyLiveZodiacPost();

  // The host's OWN live Stage — always shown (even for business accounts, which
  // otherwise don't browse the rail) so they can jump back into their Stage.
  const { stageId: myLiveStageId, meta: myLiveStageMeta } = useMyLiveStage();
  const myStage = useMemo(() => (
    myLiveStageId
      ? {
          id: myLiveStageId,
          title: myLiveStageMeta?.title || t('your_stage_label', 'Your Stage'),
          hostId: currentUser?.uid || null,
          hostName: userProfile?.displayName || userProfile?.display_name || '',
          hostAvatar: userPhoto,
          hostGender: userProfile?.gender,
          isHost: true,
          status: 'active',
        }
      : null
  ), [myLiveStageId, myLiveStageMeta?.title, currentUser?.uid, userProfile?.displayName, userProfile?.display_name, userProfile?.gender, userPhoto, t]);

  const { activeLiveStages, businessRooms } = useMemo(() => {
    if (isBusiness) {
      return { activeLiveStages: [], businessRooms: [] };
    }
    const live = (liveStages || []).filter(
      (s) => String(s?.status || 'active').toLowerCase() === 'active' && s?.id !== myLiveStageId
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
  }, [liveStages, isBusiness, myLiveStageId]);

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

  // Keep the rail visible when rooms/games/your-stage exist even if stories are still loading.
  if (loading && !myStage && !myRealOrAiCard && !myZodiacCard && zodiacPosts.length === 0 && suitabilityPosts.length === 0 && realOrAiPosts.length === 0 && activeLiveStages.length === 0 && businessRooms.length === 0 && liveGames.length === 0 && stories.length === 0) return null;

  return (
    <div style={{
      background: 'transparent',
      borderBottom: 'none',
      padding: '6px 0 2px',
      marginBottom: '0.15rem',
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

                {/* Live "Who suits you?" polls — prominent, at the very front */}
                {suitabilityPosts.map((p) => (
                  <div key={`suit-${p.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <SuitabilityCircle post={p} onClick={() => navigate(`/suitability?start=${p.id}`)} />
                  </div>
                ))}

                {/* The viewer's OWN live "Camera or AI?" card → results + end */}
                {myRealOrAiCard ? (
                  <div key={`roa-mine-${myRealOrAiCard.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <RealOrAiCircle post={myRealOrAiCard} label={t('cam_ai_your_card', 'Your card')} onClick={() => navigate('/realornai/mine')} />
                  </div>
                ) : null}

                {/* Live "Camera or AI?" rounds — prominent, at the very front */}
                {realOrAiPosts.map((p) => (
                  <div key={`roa-${p.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <RealOrAiCircle post={p} onClick={() => navigate(`/realornai?start=${p.id}`)} />
                  </div>
                ))}

                {/* The viewer's OWN live "Guess my sign?" card → results + end */}
                {myZodiacCard ? (
                  <div key={`zod-mine-${myZodiacCard.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <ZodiacCircle post={myZodiacCard} label={t('cam_ai_your_card', 'Your card')} onClick={() => navigate('/zodiac/mine')} />
                  </div>
                ) : null}

                {/* Live "Guess my sign?" cards */}
                {zodiacPosts.map((p) => (
                  <div key={`zod-${p.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <ZodiacCircle post={p} onClick={() => navigate(`/zodiac?start=${p.id}`)} />
                  </div>
                ))}

                {/* The host's own live Stage — always first, even for business accounts */}
                {myStage ? (
                  <div key={`mystage-${myStage.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <LiveStageCircle stage={myStage} onClick={() => navigate(`/stage/${myStage.id}`)} />
                  </div>
                ) : null}

                {/* Live group games (joinable lobbies) — open to everyone */}
                {liveGames.map((game) => (
                  <div key={`game-${game.id}`} role="listitem" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <LiveGameCircle
                      game={game}
                      isHost={game.hostId === currentUser?.uid}
                      onClick={() => navigate(`/group-game/${game.id}`)}
                    />
                  </div>
                ))}

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
            gender: user.partnerGender,
            isBusiness: user.partnerIsBusiness === true
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