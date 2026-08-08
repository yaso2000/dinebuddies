import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';

/**
 * Business community chat — final 3-zone layout:
 * top panel (media) · bubbles · text editor
 */
export default function CommunityFullChatView({ room, bannerMediaActive = true }) {
  const { messages, partnerId, pendingReplyTo, isHost, unpinHostMessage } = room;
  const showTop = room.bannerVisible !== false;

  return (
    <div className="community-chat-layout community-full-chat">
      {showTop ? (
        <section className="community-chat-layout__top" aria-label="Top panel">
          <CommunityTopMediaPanel room={room} bannerMediaActive={bannerMediaActive} />
          <CommunityPinnedHostBar
            messages={messages}
            partnerId={partnerId}
            pendingReplyTo={pendingReplyTo}
            isHost={isHost}
            onUnpinHostMessage={isHost ? unpinHostMessage : undefined}
          />
        </section>
      ) : null}
      <CommunityGuestChatBody room={room} className="community-guest-chat--expanded" />
    </div>
  );
}
