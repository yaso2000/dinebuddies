import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';

/** Left panel — compact banner + guest chat filling the screen. */
export default function CommunityFullChatView({ room, bannerMediaActive = true }) {
  const { messages, partnerId, pendingReplyTo, isHost, unpinHostMessage } = room;

  return (
    <div className="community-full-chat">
      <CommunityTopMediaPanel room={room} bannerMediaActive={bannerMediaActive} />
      <CommunityPinnedHostBar
        messages={messages}
        partnerId={partnerId}
        pendingReplyTo={pendingReplyTo}
        isHost={isHost}
        onUnpinHostMessage={isHost ? unpinHostMessage : undefined}
      />
      <CommunityGuestChatBody room={room} className="community-guest-chat--expanded" />
    </div>
  );
}
