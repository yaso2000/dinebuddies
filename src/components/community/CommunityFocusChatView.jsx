import React from 'react';
import { useTranslation } from 'react-i18next';
import CommunityChatMessages from './CommunityChatMessages';
import CommunityChatComposer from './CommunityChatComposer';
import { getAppTextDirection } from '../../utils/bidiText';

/** Full-screen large-type chat (no banner) — reads shared `room` state only. */
export default function CommunityFocusChatView({ room }) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const { messages, sendMessage, sendImageMessage, uploadingChatImage, isMutedInChat, currentUserId, partnerId, deleteChatMessage } = room;

  return (
    <div className="community-focus-chat" dir={contentDir}>
      <CommunityChatMessages
        messages={messages}
        currentUserId={currentUserId}
        partnerId={partnerId}
        onDeleteMessage={deleteChatMessage}
        variant="focus"
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
        />
      </div>
    </div>
  );
}
