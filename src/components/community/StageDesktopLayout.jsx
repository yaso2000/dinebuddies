import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';
import CommunityParticipantsView from './CommunityParticipantsView';
import ProfileGiftPickerModal from '../gifts/ProfileGiftPickerModal';
import './StageDesktopLayout.css';

/**
 * Stage rooms only, desktop width — main column (banner + chat bubbles) next to a
 * fixed sidebar (members, gift box always visible instead of a popup). Community
 * business chat keeps the single-column CommunityFullChatView unchanged.
 */
export default function StageDesktopLayout({ room, giftRecipient }) {
  const { messages, pendingReplyTo, isHost, unpinHostMessage } = room;
  const showTop = room.bannerVisible !== false;
  const hostMessageOwnerId = room.hostId || room.partnerId;

  return (
    <div className="stage-desktop-layout">
      <div className="stage-desktop-layout__main">
        {showTop ? (
          <section className="stage-desktop-layout__top" aria-label="Top panel">
            <CommunityTopMediaPanel room={room} bannerMediaActive />
            <CommunityPinnedHostBar
              messages={messages}
              partnerId={hostMessageOwnerId}
              pendingReplyTo={pendingReplyTo}
              isHost={isHost}
              onUnpinHostMessage={isHost ? unpinHostMessage : undefined}
            />
          </section>
        ) : null}
        <CommunityGuestChatBody room={room} className="community-guest-chat--expanded" />
      </div>

      <aside className="stage-desktop-layout__sidebar">
        <div className="stage-desktop-layout__members">
          <CommunityParticipantsView
            participants={room.participants}
            loading={room.participantsLoading}
            partnerId={room.partnerId}
            isHost={Boolean(room.isHost)}
            isStageRoom={Boolean(room.isStageRoom)}
            onMuteMember={room.muteMemberInChat}
            onKickMember={room.kickMemberFromStage}
            onBlockMember={room.blockMemberFromStages}
          />
        </div>
        {giftRecipient ? (
          <div className="stage-desktop-layout__gifts">
            <ProfileGiftPickerModal recipient={giftRecipient} embedded />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
