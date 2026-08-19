import React, { useEffect, useRef } from 'react';
import CommunityTopMediaPanel from './CommunityTopMediaPanel';
import CommunityPinnedHostBar from './CommunityPinnedHostBar';
import CommunityChatMessages from './CommunityChatMessages';
import { getAppTextDirection } from '../../utils/bidiText';
import { useTranslation } from 'react-i18next';

/** Read-only venue display — banner + live guest chat for TV screens. */
export default function CommunityChatCastView({ room }) {
  const { i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const messageListRef = useRef(null);
  const { messages, partnerId, partner, bannerVisible } = room;
  // Stage rooms: `partnerId` is the stage document id, not the host's user id
  // — `hostId` (only present on the Stage hook) is the correct id to match
  // `message.senderId` against. Community Chat has no `hostId`, where
  // `partnerId` already equals the host's uid.
  const hostMessageOwnerId = room.hostId || partnerId;

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) return undefined;
    const scrollToBottom = () => {
      node.scrollTop = node.scrollHeight;
    };
    scrollToBottom();
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [messages.length]);

  const venueName = partner?.display_name || partner?.businessInfo?.name || '';

  return (
    <div className="community-chat-cast">
      <header className="community-chat-cast__header">
        <div className="community-chat-cast__brand">
          {partner?.photo_url ? (
            <img
              src={partner.photo_url}
              alt=""
              className="community-chat-cast__logo"
            />
          ) : null}
          <span className="community-chat-cast__title">{venueName}</span>
        </div>
        <span className="community-chat-cast__badge">LIVE</span>
      </header>

      <div className="community-chat-cast__body">
        {bannerVisible !== false ? (
          <>
            <CommunityTopMediaPanel room={room} bannerMediaActive />
            <CommunityPinnedHostBar
              messages={messages}
              partnerId={hostMessageOwnerId}
              pendingReplyTo={null}
              isHost={false}
            />
          </>
        ) : null}

        <div
          ref={messageListRef}
          className="community-chat-cast__messages"
          dir={contentDir}
        >
          <CommunityChatMessages
            messages={messages}
            currentUserId={room.currentUserId}
            partnerId={hostMessageOwnerId}
            isHost={false}
            variant="normal"
          />
        </div>
      </div>
    </div>
  );
}
