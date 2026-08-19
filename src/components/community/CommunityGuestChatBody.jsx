import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CommunityChatMessages from './CommunityChatMessages';
import CommunityChatComposer from './CommunityChatComposer';
import StageHostGuestModerationMenu from './StageHostGuestModerationMenu';
import { getAppTextDirection } from '../../utils/bidiText';

/**
 * Bubbles zone includes the text editor — one shared frame (not a separate bar below).
 * Parent supplies the top panel (media / pin bar).
 */
export default function CommunityGuestChatBody({ room, className = '' }) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const {
    messages,
    isMutedInChat,
    isHost,
    isStageClosed,
    isStageRoom,
    sendMessage,
    sendImageMessage,
    uploadingChatImage,
    currentUserId,
    partnerId,
    pendingReplyTo,
    startReplyToMessage,
    cancelReplyToMessage,
    deleteChatMessage,
    muteMemberInChat,
    kickMemberFromStage,
    blockMemberFromStages,
    pinHostMessage,
    unpinHostMessage,
    showMessageOnBanner,
    hideMessageFromBanner,
    onSendGiftToHost,
  } = room;
  // Stage rooms: `partnerId` is the stage document id, not the host's user id
  // — `hostId` (only present on the Stage hook) is the correct id to match
  // `message.senderId` against. Community Chat has no `hostId`, where
  // `partnerId` already equals the host's uid.
  const hostMessageOwnerId = room.hostId || partnerId;
  const composerBlocked = Boolean(isMutedInChat || isStageClosed);
  const canSendGift = !isHost && typeof onSendGiftToHost === 'function';
  const [modMenu, setModMenu] = useState(null);
  const [modBusy, setModBusy] = useState(false);

  const handleReply = useCallback(
    (message) => {
      startReplyToMessage(message);
    },
    [startReplyToMessage]
  );

  const handleDelete = useCallback(
    (message) => {
      void deleteChatMessage(message);
    },
    [deleteChatMessage]
  );

  const handleMute = useCallback(
    (message) => {
      if (!message?.senderId || message.senderId === hostMessageOwnerId) return;
      if (isStageRoom) {
        setModMenu({
          member: {
            id: message.senderId,
            displayName: message.senderName || t('member', 'Member'),
          },
          rect: null,
        });
        return;
      }
      void muteMemberInChat(message.senderId);
    },
    [isStageRoom, muteMemberInChat, hostMessageOwnerId, t]
  );

  const handlePin = useCallback(
    (message) => {
      if (!message?.id) return;
      void pinHostMessage(message.id);
    },
    [pinHostMessage]
  );

  const handleUnpin = useCallback(
    (message) => {
      if (!message?.id) return;
      void unpinHostMessage(message.id);
    },
    [unpinHostMessage]
  );

  const handleShowOnBanner = useCallback(
    (message) => {
      if (!message?.id) return;
      void showMessageOnBanner(message.id);
    },
    [showMessageOnBanner]
  );

  const handleHideFromBanner = useCallback(
    (message) => {
      if (!message?.id) return;
      void hideMessageFromBanner(message.id);
    },
    [hideMessageFromBanner]
  );

  const runMod = useCallback(async (runner) => {
    if (modBusy) return;
    setModBusy(true);
    try {
      await runner();
    } finally {
      setModBusy(false);
      setModMenu(null);
    }
  }, [modBusy]);

  const rootClass = ['community-guest-chat', 'community-chat-layout__body', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} dir={contentDir}>
      <section
        className="community-guest-chat__frame community-chat-layout__bubbles"
        aria-label="Messages">
        <div className="community-guest-chat__messages-scroll">
          <CommunityChatMessages
            messages={messages}
            currentUserId={currentUserId}
            partnerId={hostMessageOwnerId}
            isHost={isHost}
            onReplyToMessage={isHost ? handleReply : undefined}
            onMuteMember={isHost ? handleMute : undefined}
            onDeleteMessage={handleDelete}
            onPinHostMessage={isHost ? handlePin : undefined}
            onUnpinHostMessage={isHost ? handleUnpin : undefined}
            onShowOnBanner={isHost ? handleShowOnBanner : undefined}
            onHideFromBanner={isHost ? handleHideFromBanner : undefined}
            variant="normal"
          />

          {isStageClosed ? (
            <div className="community-main-chat__muted" role="status">
              {t(
                'stage_closed_cannot_write',
                'This Stage is closed. The host can reopen it within 24 hours.'
              )}
            </div>
          ) : isMutedInChat ? (
            <div className="community-main-chat__muted" role="status">
              {t(
                'community_chat_muted_notice',
                'You are muted in this chat and cannot send messages.'
              )}
            </div>
          ) : null}
        </div>

        <div className="community-main-chat__composer community-chat-layout__editor" aria-label="Message editor">
          <CommunityChatComposer
            sendMessage={sendMessage}
            sendImageMessage={sendImageMessage}
            isMutedInChat={composerBlocked}
            uploadingImage={uploadingChatImage}
            pendingReplyTo={isHost ? pendingReplyTo : null}
            onCancelReply={cancelReplyToMessage}
            onSendGift={canSendGift ? onSendGiftToHost : undefined}
          />
        </div>
      </section>

      {isHost && isStageRoom ? (
        <StageHostGuestModerationMenu
          open={Boolean(modMenu)}
          anchorRect={modMenu?.rect}
          member={modMenu?.member}
          busy={modBusy}
          onClose={() => setModMenu(null)}
          onMute={(duration) =>
            runMod(async () => {
              await muteMemberInChat?.(modMenu?.member?.id, duration);
            })
          }
          onKick={() =>
            runMod(async () => {
              const ok = window.confirm(
                t(
                  'stage_remove_member_confirm',
                  'Remove this member from the Stage? They will lose access to the chat.'
                )
              );
              if (!ok) return;
              await kickMemberFromStage?.(modMenu?.member?.id);
            })
          }
          onBlock={() =>
            runMod(async () => {
              const ok = window.confirm(
                t(
                  'stage_block_member_confirm',
                  'Block this guest from all your future Stages? They will be removed from this broadcast too.'
                )
              );
              if (!ok) return;
              await blockMemberFromStages?.(modMenu?.member?.id);
            })
          }
        />
      ) : null}
    </div>
  );
}
