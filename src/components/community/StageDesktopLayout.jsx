import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';
import CommunityParticipantsView from './CommunityParticipantsView';
import ProfileGiftPickerModal from '../gifts/ProfileGiftPickerModal';
import './StageDesktopLayout.css';

/**
 * Stage rooms only, desktop width — three panes: a stage pane (tools + banner),
 * a wide chat pane (bubbles), and a sidebar (gift strip + members). Community
 * business chat keeps the single-column CommunityFullChatView unchanged.
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
        </aside>
      ) : null}

      <div className="stage-desktop-layout__main">
        <CommunityGuestChatBody room={room} className="community-guest-chat--expanded" />
      </div>

      <aside className="stage-desktop-layout__sidebar">
        {giftRecipient ? (
          <div className="stage-desktop-layout__gift-strip">
            <ProfileGiftPickerModal recipient={giftRecipient} embedded layout="strip" />
          </div>
        ) : null}
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
      </aside>
    </div>
  );
}
