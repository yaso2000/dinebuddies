import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEllipsisH } from 'react-icons/fa';
import { AppText } from '../base';
import UserAvatar from '../UserAvatar';
import CommunityChatMessageMenu from './CommunityChatMessageMenu';
import { useLongPress } from './useLongPress';
import { prepareBidiDisplayText } from '../../utils/bidiText';
import { formatAppDate, formatAppTime } from '../../utils/localeFormat';
import { getMessageReceiptDisplay } from '../../utils/chatMessageReceipts';

const NEAR_BOTTOM_PX = 72;
/** Same sender within this window → one visual cluster. */
const CLUSTER_GAP_MS = 5 * 60 * 1000;

function isListNearBottom(list) {
  if (!list) return true;
  return list.scrollHeight - list.scrollTop - list.clientHeight <= NEAR_BOTTOM_PX;
}

function scrollListToBottom(list) {
  if (!list) return;
  list.scrollTop = list.scrollHeight;
}

function isStackableText(message) {
  const type = message?.type || 'text';
  return type === 'text';
}

function isAudioMessage(message) {
  const type = String(message?.type || '').toLowerCase();
  return type === 'audio' || type === 'voice';
}

function isAtomicMessage(message) {
  const type = message?.type || 'text';
  return type === 'emoji-big' || type === 'image' || isAudioMessage(message);
}

function resolveImageSrc(message) {
  return message?.imageUrl || message?.text || '';
}

function resolveAudioUrl(message) {
  return message?.audioUrl || message?.text || '';
}

function formatAudioDuration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '0:00';
  const mins = Math.floor(n / 60);
  const secs = Math.floor(n % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function messageTimeMs(message) {
  const ts = message?.createdAt;
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function dayKeyFromMs(ms) {
  if (ms == null) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatMessageTime(message, language) {
  const ms = messageTimeMs(message);
  if (!ms) return '';
  return formatAppTime(ms, language);
}

function formatDaySeparatorLabel(ms, language, t) {
  if (ms == null) return '';
  const date = new Date(ms);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / 86400000);
  if (diffDays === 0) return t('today', 'Today');
  if (diffDays === 1) return t('yesterday', 'Yesterday');
  return formatAppDate(date, language, { day: 'numeric', month: 'long', year: 'numeric' });
}

function getClusterPosition(index, length) {
  if (length <= 1) return 'single';
  if (index === 0) return 'first';
  if (index === length - 1) return 'last';
  return 'middle';
}

function sameCluster(prevMessage, nextMessage) {
  if (!isStackableText(nextMessage) || nextMessage.senderId !== prevMessage.senderId) {
    return false;
  }
  const prevMs = messageTimeMs(prevMessage);
  const nextMs = messageTimeMs(nextMessage);
  if (prevMs == null || nextMs == null) return true;
  return Math.abs(nextMs - prevMs) <= CLUSTER_GAP_MS;
}

/** Consecutive close text from same sender → stacked cluster; day chips between calendar days. */
function buildRenderItems(messages) {
  const items = [];
  let index = 0;
  let lastDayKey = null;

  while (index < messages.length) {
    const message = messages[index];
    const ms = messageTimeMs(message);
    const key = dayKeyFromMs(ms);
    if (key && key !== lastDayKey) {
      items.push({ kind: 'day', id: `day-${key}`, ms });
      lastDayKey = key;
    }

    if (isAtomicMessage(message)) {
      items.push({ kind: 'atomic', messages: [message] });
      index += 1;
      continue;
    }

    const batch = [message];
    let next = index + 1;
    while (next < messages.length && sameCluster(batch[batch.length - 1], messages[next])) {
      batch.push(messages[next]);
      next += 1;
    }

    items.push({ kind: 'stacked', messages: batch });
    index = next;
  }

  return items;
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

function BubbleMeta({ timeLabel, receipt }) {
  if (!timeLabel && !receipt) return null;
  return (
    <div className="community-main-chat__bubble-meta">
      {timeLabel ? (
        <AppText as="span" className="community-main-chat__bubble-time" dir="ltr">
          {timeLabel}
        </AppText>
      ) : null}
      {receipt ? (
        <span
          className={`community-main-chat__bubble-status community-main-chat__bubble-status--${receipt.state}`}
          aria-hidden
        >
          {receipt.ticks}
        </span>
      ) : null}
    </div>
  );
}

function CommunityChatMessageSegment({
  msg,
  outgoing,
  isHostMessage,
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
  clusterPosition = 'single',
}) {
  const segmentRef = useRef(null);
  const interactive =
    canReply || canMute || canPin || canUnpin || canShowOnBanner || canHideFromBanner || canDelete;
  const messageBidi = prepareBidiDisplayText(msg.text, language);
  const timeLabel = formatMessageTime(msg, language);
  const receipt = outgoing ? getMessageReceiptDisplay(msg, msg.senderId) : null;
  const isTail = clusterPosition === 'last' || clusterPosition === 'single';

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

  const segmentClass = [
    'community-main-chat__bubble-segment',
    `community-main-chat__bubble-segment--${clusterPosition}`,
    outgoing || isHostMessage
      ? 'community-main-chat__bubble-segment--outgoing'
      : 'community-main-chat__bubble-segment--incoming',
    isHostMessage && !outgoing ? 'community-main-chat__bubble-segment--host' : '',
    isPinned ? 'community-main-chat__bubble-segment--pinned' : '',
    isTail ? 'community-main-chat__bubble-segment--tail' : '',
    interactive ? 'community-main-chat__bubble-segment--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={segmentRef}
      className={segmentClass}
      onContextMenu={handleContextMenu}
      {...longPress}
    >
      <div className="community-main-chat__bubble-inner">
        <AppText
          as="p"
          dir={messageBidi.dir}
          lang={messageBidi.lang}
          format={false}
          className="community-main-chat__bubble-text"
        >
          {messageBidi.text}
        </AppText>
        <BubbleMeta timeLabel={timeLabel} receipt={receipt} />
      </div>
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
  const last = messages[messages.length - 1];
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
  // Own + host stay on the physical right (list is dir=ltr for sides).
  const alignRight = perms.outgoing || perms.isHostMessage;
  const showGuestChrome = !alignRight;
  const showSender =
    showGuestChrome && Boolean(first.senderName || first.senderId);
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
    alignRight ? 'community-main-chat__message--outgoing' : 'community-main-chat__message--incoming',
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
        {showGuestChrome ? (
          <div className="community-main-chat__avatar-column" aria-hidden={!showGuestChrome}>
            <div className="community-main-chat__avatar-slot community-main-chat__avatar-slot--tail">
              <UserAvatar
                user={{
                  photo_url: last.senderAvatar || first.senderAvatar,
                  display_name: last.senderName || first.senderName,
                  gender: last.senderGender || first.senderGender,
                }}
                className="community-main-chat__avatar"
                style={{ width: 32, height: 32 }}
                alt=""
              />
            </div>
          </div>
        ) : null}

        <div className="community-main-chat__message-body">
          {showSender ? (
            <AppText as="span" className="community-main-chat__sender">
              {first.senderName || t('user', 'User')}
            </AppText>
          ) : null}

          <div
            className={`community-main-chat__bubble-stack${
              alignRight
                ? ' community-main-chat__bubble-stack--outgoing community-main-chat__bubble-stack--outer-end'
                : ' community-main-chat__bubble-stack--incoming community-main-chat__bubble-stack--outer-start'
            }${perms.isHostMessage && !perms.outgoing ? ' community-main-chat__bubble-stack--host' : ''}`}
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

              return (
                <CommunityChatMessageSegment
                  key={msg.id}
                  msg={msg}
                  outgoing={segmentPerms.outgoing}
                  isHostMessage={segmentPerms.isHostMessage}
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
                  clusterPosition={getClusterPosition(index, messages.length)}
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
  const isAudio = isAudioMessage(msg);
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
  const showGuestChrome = !alignRight;
  const showSender = showGuestChrome && !isBigEmoji;
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
    alignRight ? 'community-main-chat__message--outgoing' : 'community-main-chat__message--incoming',
    perms.isHostMessage ? 'community-main-chat__message--host' : '',
    isBigEmoji ? 'community-main-chat__message--emoji' : 'community-main-chat__message--standalone',
    interactive ? 'community-main-chat__message--interactive' : '',
    msg.pinned ? 'community-main-chat__message--pinned' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const bubbleToneClass = alignRight
    ? `community-main-chat__bubble--outgoing${perms.isHostMessage && !perms.outgoing ? ' community-main-chat__bubble--host' : ''}`
    : 'community-main-chat__bubble--incoming';

  return (
    <li className={rowClass}>
      <div className={`community-main-chat__message-row${isBigEmoji ? ' community-main-chat__message-row--emoji' : ''}`}>
        {showGuestChrome ? (
          <div className="community-main-chat__avatar-column">
            <div className="community-main-chat__avatar-slot community-main-chat__avatar-slot--tail">
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
            <div className={`community-main-chat__bubble community-main-chat__bubble--image ${bubbleToneClass}`}>
              <img src={resolveImageSrc(msg)} alt="" className="community-main-chat__chat-image" />
              {timeLabel || receipt ? (
                <div className="community-main-chat__bubble-meta community-main-chat__bubble-meta--overlay">
                  {timeLabel ? (
                    <AppText as="span" className="community-main-chat__bubble-time" dir="ltr">
                      {timeLabel}
                    </AppText>
                  ) : null}
                  {receipt ? (
                    <span
                      className={`community-main-chat__bubble-status community-main-chat__bubble-status--${receipt.state}`}
                      aria-hidden
                    >
                      {receipt.ticks}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : isAudio ? (
            <div className={`community-main-chat__bubble community-main-chat__bubble--audio ${bubbleToneClass} community-main-chat__bubble--single`}>
              <div className="community-main-chat__bubble-inner">
                <audio
                  className="community-main-chat__chat-audio"
                  controls
                  preload="metadata"
                  src={resolveAudioUrl(msg)}
                />
                <AppText as="span" className="community-main-chat__audio-duration" dir="ltr">
                  {formatAudioDuration(msg.duration)}
                </AppText>
                <BubbleMeta timeLabel={timeLabel} receipt={receipt} />
              </div>
            </div>
          ) : (
            <div
              className={`community-main-chat__bubble${isBigEmoji ? ' community-main-chat__bubble--emoji' : ''} ${bubbleToneClass} community-main-chat__bubble--single`}
            >
              {!isBigEmoji ? (
                <div className="community-main-chat__bubble-inner">
                  <AppText
                    as="p"
                    dir={messageBidi.dir}
                    lang={messageBidi.lang}
                    format={false}
                    className="community-main-chat__bubble-text"
                  >
                    {messageBidi.text}
                  </AppText>
                  <BubbleMeta timeLabel={timeLabel} receipt={receipt} />
                </div>
              ) : (
                <AppText
                  as="p"
                  dir={messageBidi.dir}
                  lang={messageBidi.lang}
                  format={false}
                  className="community-main-chat__bubble-emoji-text"
                >
                  {messageBidi.text}
                </AppText>
              )}
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

function CommunityChatDaySeparator({ ms, language, t }) {
  const label = formatDaySeparatorLabel(ms, language, t);
  if (!label) return null;
  return (
    <li className="community-main-chat__day-sep" aria-label={label}>
      <span className="community-main-chat__day-sep-chip">{label}</span>
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
  emptyContent = null,
  onReplyToMessage,
  onMuteMember,
  onDeleteMessage,
  onPinHostMessage,
  onUnpinHostMessage,
  onShowOnBanner,
  onHideFromBanner,
}) {
  const { t, i18n } = useTranslation();
  const listRef = useRef(null);
  const pinnedToBottomRef = useRef(true);
  const [menu, setMenu] = useState(null);
  const renderItems = buildRenderItems(messages);

  const pinToBottomIfNeeded = useCallback(() => {
    const list = listRef.current;
    if (!list || !pinnedToBottomRef.current) return;
    scrollListToBottom(list);
    requestAnimationFrame(() => {
      if (!pinnedToBottomRef.current) return;
      scrollListToBottom(list);
      requestAnimationFrame(() => {
        if (pinnedToBottomRef.current) scrollListToBottom(list);
      });
    });
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const onScroll = () => {
      pinnedToBottomRef.current = isListNearBottom(list);
    };

    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    pinToBottomIfNeeded();
  }, [messages, pinToBottomIfNeeded]);

  useEffect(() => {
    const list = listRef.current;
    const onViewportChange = () => pinToBottomIfNeeded();

    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    window.addEventListener('resize', onViewportChange);

    const attrObserver = new MutationObserver(onViewportChange);
    attrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chat-keyboard-open', 'data-keyboard-open'],
    });

    const resizeObserver = list ? new ResizeObserver(onViewportChange) : null;
    if (list) resizeObserver.observe(list);

    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      attrObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [pinToBottomIfNeeded]);

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
      {/* dir=ltr keeps own bubbles on the physical right in Arabic UI */}
      <ul
        ref={listRef}
        className={rootClass}
        dir="ltr"
        aria-label={t('community_chat', 'Community Chat')}
      >
        {messages.length === 0 ? (
          <li className="community-main-chat__empty">
            {emptyContent || <AppText as="p">{t('no_messages_yet', 'No messages yet')}</AppText>}
          </li>
        ) : (
          renderItems.map((item) => {
            if (item.kind === 'day') {
              return (
                <CommunityChatDaySeparator
                  key={item.id}
                  ms={item.ms}
                  language={i18n.language}
                  t={t}
                />
              );
            }

            if (item.kind === 'stacked') {
              return (
                <CommunityChatTextStack
                  key={item.messages[0].id}
                  messages={item.messages}
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
                key={item.messages[0].id}
                msg={item.messages[0]}
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
