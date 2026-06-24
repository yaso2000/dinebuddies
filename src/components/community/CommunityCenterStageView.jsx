import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';

/** Default center — host media stage + guest chat strip below. */
export default function CommunityCenterStageView({ room, bannerMediaActive = true }) {
  const { messages, partnerId, pendingReplyTo, isHost, unpinHostMessage } = room;

  return (
    <div className="community-center-stage">
      <CommunityTopMediaPanel room={room} bannerExpanded bannerMediaActive={bannerMediaActive} />
      <CommunityPinnedHostBar
        messages={messages}
        partnerId={partnerId}
        pendingReplyTo={pendingReplyTo}
        isHost={isHost}
        onUnpinHostMessage={isHost ? unpinHostMessage : undefined}
      />
      <CommunityGuestChatBody room={room} className="community-guest-chat--center" />
    </div>
  );
}
