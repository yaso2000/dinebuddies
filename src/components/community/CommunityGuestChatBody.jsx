import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import CommunityChatMessages from './CommunityChatMessages';
import CommunityChatComposer from './CommunityChatComposer';
import { getAppTextDirection } from '../../utils/bidiText';

/** Guest/member chat — host messages in thread; pin bar and banner bubble are separate. */
export default function CommunityGuestChatBody({ room, className = '' }) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const {
    messages,
    isMutedInChat,
    isHost,
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
    pinHostMessage,
    unpinHostMessage,
    showMessageOnBanner,
    hideMessageFromBanner,
  } = room;

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
      if (!message?.senderId) return;
      void muteMemberInChat(message.senderId);
    },
    [muteMemberInChat]
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

  const rootClass = ['community-guest-chat', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} dir={contentDir}>
      <CommunityChatMessages
        messages={messages}
        currentUserId={currentUserId}
        partnerId={partnerId}
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

      {isMutedInChat ? (
        <div className="community-main-chat__muted" role="status">
          {t(
            'community_chat_muted_notice',
            'You are muted in this chat and cannot send messages.'
          )}
        </div>
      ) : null}

      <div className="community-main-chat__composer">
        <CommunityChatComposer
          sendMessage={sendMessage}
          sendImageMessage={sendImageMessage}
          isMutedInChat={isMutedInChat}
          uploadingImage={uploadingChatImage}
          pendingReplyTo={isHost ? pendingReplyTo : null}
          onCancelReply={cancelReplyToMessage}
        />
      </div>
    </div>
  );
}
