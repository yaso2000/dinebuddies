import React from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityGuestChatBody from './CommunityGuestChatBody';
import CommunityParticipantsView from './CommunityParticipantsView';
import './StageDesktopLayout.css';

/**
 * Stage rooms only, desktop width — two panes: a stage pane (tools + banner +
 * avatar-only participants grid) and a wide chat pane (bubbles + composer).
 * Gifts stay reachable via the in-chat gift button (no dedicated strip/sidebar —
 * removed per feedback so the banner/chat get the space instead). Community
 * business chat keeps the single-column CommunityFullChatView unchanged.
 */
export default function StageDesktopLayout({ room, onGiftParticipant }) {
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
              onGift={onGiftParticipant}
              layout="grid"
            />
          </div>
        </aside>
      ) : null}

      <div className="stage-desktop-layout__main">
        <CommunityGuestChatBody room={room} className="community-guest-chat--expanded" />
      </div>
    </div>
  );
}
