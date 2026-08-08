import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';

/**
 * Default center stage — same final 3-zone shell with a slightly taller top panel.
 */
export default function CommunityCenterStageView({ room, bannerMediaActive = true }) {
  const { messages, partnerId, pendingReplyTo, isHost, unpinHostMessage } = room;
  const showTop = room.bannerVisible !== false;

  return (
    <div className="community-chat-layout community-center-stage">
      {showTop ? (
        <section className="community-chat-layout__top community-chat-layout__top--stage" aria-label="Top panel">
          <CommunityTopMediaPanel room={room} bannerExpanded bannerMediaActive={bannerMediaActive} />
          <CommunityPinnedHostBar
            messages={messages}
            partnerId={partnerId}
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
