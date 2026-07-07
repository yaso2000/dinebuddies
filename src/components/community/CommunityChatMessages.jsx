import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEllipsisH } from 'react-icons/fa';
import { AppText } from '../base';
import UserAvatar from '../UserAvatar';
import CommunityChatMessageMenu from './CommunityChatMessageMenu';
import { useLongPress } from './useLongPress';
import { getAppTextDirection, prepareBidiDisplayText } from '../../utils/bidiText';
import { formatAppTime } from '../../utils/localeFormat';
import { getMessageReceiptDisplay } from '../../utils/chatMessageReceipts';

function isStackableText(message) {
  const type = message?.type || 'text';
  return type === 'text';
}

function isAtomicMessage(message) {
  const type = message?.type || 'text';
  return type === 'emoji-big' || type === 'image';
}

/** Consecutive text messages from the same sender → one stacked bubble. */
function buildRenderGroups(messages) {
  const groups = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];

    if (isAtomicMessage(message)) {
      groups.push({ kind: 'atomic', messages: [message] });
      index += 1;
      continue;
    }

    const batch = [message];
    let next = index + 1;
    while (
      next < messages.length &&
      isStackableText(messages[next]) &&
      messages[next].senderId === message.senderId
    ) {
      batch.push(messages[next]);
      next += 1;
    }

    groups.push({ kind: 'stacked', messages: batch });
    index = next;
  }

  return groups;
}

function messageTimeMs(message) {
  const ts = message?.createdAt;
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function formatMessageTime(message, language) {
  const ms = messageTimeMs(message);
  if (!ms) return '';
  return formatAppTime(ms, language);
}

function getMessagePermissions({
  msg,
  currentUserId,
  partnerId,
  isHost,
  onReplyToMessage,
  onMuteMember,
  onPinHostMessage,
  onUnpinHostMessage,
  onShowOnBanner,
  onHideFromBanner,
  onDeleteMessage,
}) {
  const outgoing = msg.senderId === currentUserId;
  const isHostMessage = Boolean(partnerId && msg.senderId === partnerId);
  const isGuestMessage = Boolean(partnerId && msg.senderId !== partnerId);

  return {
    outgoing,
    isHostMessage,
    canReply: Boolean(isHost && isGuestMessage && onReplyToMessage),
    canMute: Boolean(isHost && isGuestMessage && onMuteMember),
    canPin: Boolean(isHost && isHostMessage && onPinHostMessage && !msg.pinned),
    canUnpin: Boolean(isHost && isHostMessage && onUnpinHostMessage && msg.pinned),
    canShowOnBanner: Boolean(isHost && isHostMessage && onShowOnBanner && !msg.bannerSpotlight),
    canHideFromBanner: Boolean(isHost && isHostMessage && onHideFromBanner && msg.bannerSpotlight),
    canDelete: Boolean(onDeleteMessage && (isHost || msg.senderId === currentUserId)),
  };
}

function CommunityChatMessageSegment({
  msg,
  outgoing,
  isPinned,
  canReply,
  canMute,
  canPin,
  canUnpin,
  canShowOnBanner,
  canHideFromBanner,
  canDelete,
  onOpenMenu,
  language,
  showMeta,
  isStackTail = false,
}) {
  const segmentRef = useRef(null);
  const interactive = canReply || canMute || canPin || canUnpin || canShowOnBanner || canHideFromBanner || canDelete;
  const messageBidi = prepareBidiDisplayText(msg.text, language);
  const timeLabel = formatMessageTime(msg, language);
  const receipt = outgoing ? getMessageReceiptDisplay(msg, msg.senderId) : null;

  const openMenu = () => {
    const rect = segmentRef.current?.getBoundingClientRect();
    if (!rect) return;
    onOpenMenu?.(msg, rect, {
      canReply,
      canMute,
      canPin,
      canUnpin,
      canShowOnBanner,
      canHideFromBanner,
      canDelete,
    });
  };

  const handleContextMenu = (event) => {
    if (!interactive) return;
    event.preventDefault();
    openMenu();
  };

  const longPress = useLongPress(openMenu, { disabled: !interactive });

  return (
    <div
      ref={segmentRef}
      className={`community-main-chat__bubble-segment${interactive ? ' community-main-chat__bubble-segment--interactive' : ''}${isPinned ? ' community-main-chat__bubble-segment--pinned' : ''}${isStackTail ? ' community-main-chat__bubble-segment--tail' : ''}`}
      onContextMenu={handleContextMenu}
      {...longPress}
    >
      <AppText
        as="p"
        dir={messageBidi.dir}
        lang={messageBidi.lang}
        format={false}
        className="community-main-chat__bubble-text"
      >
        {messageBidi.text}
      </AppText>
      {showMeta ? (
        <div className="community-main-chat__bubble-meta">
          {timeLabel ? (
            <AppText as="span" className="community-main-chat__bubble-time" dir="ltr">
              {timeLabel}
            </AppText>
          ) : null}
          {receipt ? (
            <span className={`community-main-chat__bubble-status community-main-chat__bubble-status--${receipt.state}`} aria-hidden>
              {receipt.ticks}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CommunityChatTextStack({
  messages,
  currentUserId,
  partnerId,
  isHost,
  onOpenMenu,
  onReplyToMessage,
  onMuteMember,
  onPinHostMessage,
  onUnpinHostMessage,
  onShowOnBanner,
  onHideFromBanner,
  onDeleteMessage,
  t,
  language,
}) {
  const first = messages[0];
  const perms = getMessagePermissions({
    msg: first,
    currentUserId,
    partnerId,
    isHost,
    onReplyToMessage,
    onMuteMember,
    onPinHostMessage,
    onUnpinHostMessage,
    onShowOnBanner,
    onHideFromBanner,
    onDeleteMessage,
  });
  const alignRight = perms.outgoing || perms.isHostMessage;
  const showGuestAvatar = !alignRight;
  const showSender =
    !perms.outgoing && !perms.isHostMessage && Boolean(first.senderName || first.senderId);
  const stackInteractive = messages.some((msg) => {
    const p = getMessagePermissions({
      msg,
      currentUserId,
      partnerId,
      isHost,
      onReplyToMessage,
      onMuteMember,
      onPinHostMessage,
      onUnpinHostMessage,
      onShowOnBanner,
      onHideFromBanner,
      onDeleteMessage,
    });
    return (
      p.canReply ||
      p.canMute ||
      p.canPin ||
      p.canUnpin ||
      p.canShowOnBanner ||
      p.canHideFromBanner ||
      p.canDelete
    );
  });

  const rowClass = [
    'community-main-chat__message',
    alignRight ? 'community-main-chat__message--outgoing' : '',
    perms.isHostMessage ? 'community-main-chat__message--host' : '',
    'community-main-chat__message--stacked',
    messages.length > 1 ? 'community-main-chat__message--stacked-multi' : 'community-main-chat__message--standalone',
    stackInteractive ? 'community-main-chat__message--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={rowClass}>
      <div className="community-main-chat__message-row">
        {showGuestAvatar ? (
          <div className="community-main-chat__avatar-slot">
            <UserAvatar
              user={{
                photo_url: first.senderAvatar,
                display_name: first.senderName,
                gender: first.senderGender,
              }}
              className="community-main-chat__avatar"
              style={{ width: 32, height: 32 }}
              alt=""
            />
          </div>
        ) : null}

        <div className="community-main-chat__message-body">
          {showSender ? (
            <AppText as="span" className="community-main-chat__sender">
              {first.senderName || t('user', 'User')}
            </AppText>
          ) : null}
          <div
            className={`community-main-chat__bubble-stack${alignRight ? ' community-main-chat__bubble-stack--outgoing community-main-chat__bubble-stack--outer-end' : ' community-main-chat__bubble-stack--incoming community-main-chat__bubble-stack--outer-start'}${perms.isHostMessage && !perms.outgoing ? ' community-main-chat__bubble-stack--host' : ''}`}
          >
            {messages.map((msg, index) => {
              const segmentPerms = getMessagePermissions({
                msg,
                currentUserId,
                partnerId,
                isHost,
                onReplyToMessage,
                onMuteMember,
                onPinHostMessage,
                onUnpinHostMessage,
                onShowOnBanner,
                onHideFromBanner,
                onDeleteMessage,
              });
              const isStackTail = index === messages.length - 1;

              return (
                <CommunityChatMessageSegment
                  key={msg.id}
                  msg={msg}
                  outgoing={segmentPerms.outgoing}
                  isPinned={Boolean(msg.pinned)}
                  canReply={segmentPerms.canReply}
                  canMute={segmentPerms.canMute}
                  canPin={segmentPerms.canPin}
                  canUnpin={segmentPerms.canUnpin}
                  canShowOnBanner={segmentPerms.canShowOnBanner}
                  canHideFromBanner={segmentPerms.canHideFromBanner}
                  canDelete={segmentPerms.canDelete}
                  onOpenMenu={onOpenMenu}
                  language={language}
                  showMeta
                  isStackTail={isStackTail}
                />
              );
            })}
          </div>
        </div>
      </div>
    </li>
  );
}

function CommunityChatMessageAtomic({
  msg,
  currentUserId,
  partnerId,
  isHost,
  onOpenMenu,
  onReplyToMessage,
  onMuteMember,
  onPinHostMessage,
  onUnpinHostMessage,
  onShowOnBanner,
  onHideFromBanner,
  onDeleteMessage,
  t,
  language,
}) {
  const bubbleRef = useRef(null);
  const isImage = msg.type === 'image';
  const isBigEmoji = msg.type === 'emoji-big';
  const perms = getMessagePermissions({
    msg,
    currentUserId,
    partnerId,
    isHost,
    onReplyToMessage,
    onMuteMember,
    onPinHostMessage,
    onUnpinHostMessage,
    onShowOnBanner,
    onHideFromBanner,
    onDeleteMessage,
  });
  const alignRight = perms.outgoing || perms.isHostMessage;
  const showGuestAvatar = !alignRight;
  const showSender = !alignRight && !perms.isHostMessage && !isBigEmoji;
  const interactive =
    perms.canReply ||
    perms.canMute ||
    perms.canPin ||
    perms.canUnpin ||
    perms.canShowOnBanner ||
    perms.canHideFromBanner ||
    perms.canDelete;
  const messageBidi = prepareBidiDisplayText(msg.text, language);
  const timeLabel = formatMessageTime(msg, language);
  const receipt = getMessageReceiptDisplay(msg, currentUserId);

  const openMenu = () => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    onOpenMenu?.(msg, rect, {
      canReply: perms.canReply,
      canMute: perms.canMute,
      canPin: perms.canPin,
      canUnpin: perms.canUnpin,
      canShowOnBanner: perms.canShowOnBanner,
      canHideFromBanner: perms.canHideFromBanner,
      canDelete: perms.canDelete,
    });
  };

  const handleContextMenu = (event) => {
    if (!interactive) return;
    event.preventDefault();
    openMenu();
  };

  const longPress = useLongPress(openMenu, { disabled: !interactive });

  const rowClass = [
    'community-main-chat__message',
    alignRight ? 'community-main-chat__message--outgoing' : '',
    perms.isHostMessage ? 'community-main-chat__message--host' : '',
    isBigEmoji ? 'community-main-chat__message--emoji' : 'community-main-chat__message--standalone',
    interactive ? 'community-main-chat__message--interactive' : '',
    msg.pinned ? 'community-main-chat__message--pinned' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={rowClass}>
      <div className={`community-main-chat__message-row${isBigEmoji ? ' community-main-chat__message-row--emoji' : ''}`}>
        {showGuestAvatar ? (
          <div className="community-main-chat__avatar-slot">
            <UserAvatar
              user={{
                photo_url: msg.senderAvatar,
                display_name: msg.senderName,
                gender: msg.senderGender,
              }}
              className="community-main-chat__avatar"
              style={{ width: 32, height: 32 }}
              alt=""
            />
          </div>
        ) : null}

        <div
          className="community-main-chat__message-body"
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          {...longPress}
        >
          {showSender ? (
            <AppText as="span" className="community-main-chat__sender">
              {msg.senderName || t('user', 'User')}
            </AppText>
          ) : null}
          {isImage ? (
            <div className="community-main-chat__bubble community-main-chat__bubble--image">
              <img src={msg.text} alt="" className="community-main-chat__chat-image" />
              {timeLabel ? (
                <div className="community-main-chat__bubble-meta community-main-chat__bubble-meta--overlay">
                  <AppText as="span" className="community-main-chat__bubble-time" dir="ltr">
                    {timeLabel}
                  </AppText>
                  {receipt ? (
                    <span className={`community-main-chat__bubble-status community-main-chat__bubble-status--${receipt.state}`} aria-hidden>
                      {receipt.ticks}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className={`community-main-chat__bubble${isBigEmoji ? ' community-main-chat__bubble--emoji' : ''}${!isBigEmoji && alignRight ? ' community-main-chat__bubble--outgoing community-main-chat__bubble--outer-end' : ''}${!isBigEmoji && !alignRight ? ' community-main-chat__bubble--incoming community-main-chat__bubble--outer-start' : ''}${perms.isHostMessage && !perms.outgoing ? ' community-main-chat__bubble--host' : ''}`}
            >
              <AppText
                as="p"
                dir={messageBidi.dir}
                lang={messageBidi.lang}
                format={false}
                className={isBigEmoji ? 'community-main-chat__bubble-emoji-text' : 'community-main-chat__bubble-text'}
              >
                {messageBidi.text}
              </AppText>
              {!isBigEmoji && timeLabel ? (
                <div className="community-main-chat__bubble-meta">
                  <AppText as="span" className="community-main-chat__bubble-time" dir="ltr">
                    {timeLabel}
                  </AppText>
                  {receipt ? (
                    <span className={`community-main-chat__bubble-status community-main-chat__bubble-status--${receipt.state}`} aria-hidden>
                      {receipt.ticks}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {interactive ? (
          <button
            type="button"
            className="community-main-chat__message-menu-btn"
            aria-label={t('community_chat_message_actions', 'Message actions')}
            title={t('community_chat_message_actions_hint', 'Right-click or press for reply and delete')}
            onClick={(event) => {
              event.stopPropagation();
              openMenu();
            }}
          >
            <FaEllipsisH size={14} aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Shared community chat message list (center + focus screens).
 * @param {'normal' | 'focus'} variant
 */
export default function CommunityChatMessages({
  messages,
  currentUserId,
  variant = 'normal',
  isHost = false,
  partnerId,
  onReplyToMessage,
  onMuteMember,
  onDeleteMessage,
  onPinHostMessage,
  onUnpinHostMessage,
  onShowOnBanner,
  onHideFromBanner,
}) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const messagesEndRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const renderGroups = buildRenderGroups(messages);

  useEffect(() => {
    const list = messagesEndRef.current?.parentElement;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const rootClass =
    variant === 'focus'
      ? 'community-main-chat__messages community-main-chat__messages--focus'
      : 'community-main-chat__messages';

  const closeMenu = () => setMenu(null);

  const handleOpenMenu = (message, anchorRect, options) => {
    setMenu({ message, anchorRect, ...options });
  };

  return (
    <>
      <ul className={rootClass} dir={contentDir} aria-label={t('community_chat', 'Community Chat')}>
        {messages.length === 0 ? (
          <li className="community-main-chat__empty">
            <AppText as="p">{t('no_messages_yet', 'No messages yet')}</AppText>
          </li>
        ) : (
          renderGroups.map((group) => {
            if (group.kind === 'stacked') {
              return (
                <CommunityChatTextStack
                  key={group.messages[0].id}
                  messages={group.messages}
                  currentUserId={currentUserId}
                  partnerId={partnerId}
                  isHost={isHost}
                  onOpenMenu={handleOpenMenu}
                  onReplyToMessage={onReplyToMessage}
                  onMuteMember={onMuteMember}
                  onPinHostMessage={onPinHostMessage}
                  onUnpinHostMessage={onUnpinHostMessage}
                  onShowOnBanner={onShowOnBanner}
                  onHideFromBanner={onHideFromBanner}
                  onDeleteMessage={onDeleteMessage}
                  t={t}
                  language={i18n.language}
                />
              );
            }

            return (
              <CommunityChatMessageAtomic
                key={group.messages[0].id}
                msg={group.messages[0]}
                currentUserId={currentUserId}
                partnerId={partnerId}
                isHost={isHost}
                onOpenMenu={handleOpenMenu}
                onReplyToMessage={onReplyToMessage}
                onMuteMember={onMuteMember}
                onPinHostMessage={onPinHostMessage}
                onUnpinHostMessage={onUnpinHostMessage}
                onShowOnBanner={onShowOnBanner}
                onHideFromBanner={onHideFromBanner}
                onDeleteMessage={onDeleteMessage}
                t={t}
                language={i18n.language}
              />
            );
          })
        )}
        <li ref={messagesEndRef} aria-hidden />
      </ul>

      <CommunityChatMessageMenu
        open={Boolean(menu)}
        anchorRect={menu?.anchorRect}
        showReply={menu?.canReply}
        showMute={menu?.canMute}
        showPin={menu?.canPin}
        showUnpin={menu?.canUnpin}
        showOnBanner={menu?.canShowOnBanner}
        showHideFromBanner={menu?.canHideFromBanner}
        showDelete={menu?.canDelete}
        onReply={() => onReplyToMessage?.(menu?.message)}
        onMute={() => onMuteMember?.(menu?.message)}
        onPin={() => onPinHostMessage?.(menu?.message)}
        onUnpin={() => onUnpinHostMessage?.(menu?.message)}
        onShowOnBanner={() => onShowOnBanner?.(menu?.message)}
        onHideFromBanner={() => onHideFromBanner?.(menu?.message)}
        onDelete={() => onDeleteMessage?.(menu?.message)}
        onClose={closeMenu}
      />
    </>
  );
}
