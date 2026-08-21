import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';
import CommunityParticipantsView from './CommunityParticipantsView';
import ProfileGiftPickerModal from '../gifts/ProfileGiftPickerModal';
import './StageDesktopLayout.css';

/**
 * Stage rooms only, desktop width — three panes: a stage pane (tools + banner +
 * avatar-only participants grid), a wide chat pane (bubbles + composer), and a
 * sidebar dedicated to gifts (horizontal, always visible). Community business
 * chat keeps the single-column CommunityFullChatView unchanged.
 */
export default function StageDesktopLayout({ room, giftRecipient }) {
  const { messages, pendingReplyTo, isHost, unpinHostMessage } = room;
  const showTop = room.bannerVisible !== false;
  const hostMessageOwnerId = room.hostId || room.partnerId;

  return (
    <div className="stage-desktop-layout">
      {showTop ? (
        <aside className="stage-desktop-layout__stage-pane" aria-label="Stage">
          <CommunityTopMediaPanel room={room} bannerMediaActive />
          <CommunityPinnedHostBar
            messages={messages}
            partnerId={hostMessageOwnerId}
            pendingReplyTo={pendingReplyTo}
            isHost={isHost}
            onUnpinHostMessage={isHost ? unpinHostMessage : undefined}
          />
          <div className="stage-desktop-layout__members-grid">
            <CommunityParticipantsView
              participants={room.participants}
              loading={room.participantsLoading}
              partnerId={room.partnerId}
              isHost={Boolean(room.isHost)}
              isStageRoom={Boolean(room.isStageRoom)}
              onMuteMember={room.muteMemberInChat}
              onKickMember={room.kickMemberFromStage}
              onBlockMember={room.blockMemberFromStages}
              layout="grid"
            />
          </div>
        </aside>
      ) : null}

      <div className="stage-desktop-layout__main">
        <CommunityGuestChatBody room={room} className="community-guest-chat--expanded" />
      </div>

      {giftRecipient ? (
        <aside className="stage-desktop-layout__sidebar">
          <ProfileGiftPickerModal recipient={giftRecipient} embedded layout="strip" />
        </aside>
      ) : null}
    </div>
  );
}
