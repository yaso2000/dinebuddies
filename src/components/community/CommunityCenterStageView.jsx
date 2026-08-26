import React, { useState } from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';
import StageTriviaPanel from './StageTriviaPanel';

/**
 * Default center stage — same final 3-zone shell with a slightly taller top panel.
 */
export default function CommunityCenterStageView({ room, bannerMediaActive = true, onOpenMembers }) {
  const { messages, pendingReplyTo, isHost, unpinHostMessage } = room;
  const showTop = room.bannerVisible !== false;
  // Stage rooms: `partnerId` is the stage document id, not the host's user id
  // — `hostId` (only present on the Stage hook) is the correct id to match
  // `message.senderId` against. Community Chat has no `hostId`, where
  // `partnerId` already equals the host's uid.
  const hostMessageOwnerId = room.hostId || room.partnerId;
  // Only true Stages carry `hostId`; use it as the trivia stage id.
  const triviaStageId = room.hostId ? room.partnerId : null;
  // While a trivia game is running it takes over the top panel — independent of
  // the banner's show/hide toggle, and the media banner is hidden behind it.
  const [triviaActive, setTriviaActive] = useState(false);

  return (
    <div className="community-chat-layout community-center-stage">
      {triviaStageId ? (
        <StageTriviaPanel stageId={triviaStageId} isHost={isHost} onGameActiveChange={setTriviaActive} />
      ) : null}
      {showTop && !triviaActive ? (
        <section className="community-chat-layout__top community-chat-layout__top--stage" aria-label="Top panel">
          <CommunityTopMediaPanel
            room={room}
            bannerExpanded
            bannerMediaActive={bannerMediaActive}
            onOpenMembers={onOpenMembers}
          />
          <CommunityPinnedHostBar
            messages={messages}
            partnerId={hostMessageOwnerId}
            pendingReplyTo={pendingReplyTo}
            isHost={isHost}
            onUnpinHostMessage={isHost ? unpinHostMessage : undefined}
          />
        </section>
      ) : null}
      <CommunityGuestChatBody room={room} className="community-guest-chat--center" />
    </div>
  );
}
