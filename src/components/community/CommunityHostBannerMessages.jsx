import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import UserAvatar from '../UserAvatar';
import { getAppTextDirection, prepareBidiDisplayText } from '../../utils/bidiText';
import { useHostSpotlightDrag } from '../../hooks/useHostSpotlightDrag';
import { resolveNewHostSpotlightPosition } from '../../utils/communityHostSpotlightPins';
import {
    hostSpotlightEnterClassName,
    pickHostSpotlightEnterAnimation,
} from '../../utils/communityHostSpotlightAnimations';

function isAudioMessage(message) {
    const type = String(message?.type || '').toLowerCase();
    return type === 'audio' || type === 'voice';
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

function SpotlightBubble({ message, t, language, className = '', deleteControl = null }) {
  const isBigEmoji = message.type === 'emoji-big';
  const isImage = message.type === 'image';
  const isAudio = isAudioMessage(message);

  if (isImage) {
    return (
      <div
        className={`community-host-banner-messages__bubble community-host-banner-messages__bubble--image${className ? ` ${className}` : ''}`}
      >
        <img
          src={message.text}
          alt={t('community_chat_image_alt', 'Chat image')}
          className="community-host-banner-messages__image"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />
        {deleteControl}
      </div>
    );
  }

  if (isAudio) {
    const audioUrl = resolveAudioUrl(message);
    return (
      <div
        className={`community-host-banner-messages__bubble community-host-banner-messages__bubble--audio${className ? ` ${className}` : ''}`}
      >
        <audio
          className="community-host-banner-messages__audio"
          controls
          preload="metadata"
          src={audioUrl}
        />
        <AppText as="span" className="community-host-banner-messages__audio-duration">
          {formatAudioDuration(message.duration)}
        </AppText>
        {deleteControl}
      </div>
    );
  }

  const bidi = prepareBidiDisplayText(message.text, language);

  return (
    <AppText
      as="p"
      dir={bidi.dir}
      lang={bidi.lang}
      format={false}
      className={`community-host-banner-messages__bubble${isBigEmoji ? ' community-host-banner-messages__bubble--emoji' : ''}${className ? ` ${className}` : ''}`}
    >
      {bidi.text}
    </AppText>
  );
}

function buildSpotlightSnapshot({ message, quotedMessage, pendingQuoted }) {
  const quoted = quotedMessage || pendingQuoted;
  const hasReply = Boolean(message && quoted);
  const hasPendingOnly = Boolean(!message && pendingQuoted);
  const showThreadLayout = hasReply || hasPendingOnly;

  return {
    message,
    quoted,
    hasReply,
    hasPendingOnly,
    showThreadLayout,
    key: message?.id || (pendingQuoted ? `pending-${pendingQuoted.id}` : 'empty'),
  };
}

function BannerSpotlightContent({
  snapshot,
  contentDir,
  language,
  t,
  editable,
  selected,
  onDelete,
}) {
  const { message, quoted, hasReply, hasPendingOnly, showThreadLayout } = snapshot;

  const actionBar =
    editable && selected && message ? (
      <div className="community-host-banner-messages__actions">
        <button
          type="button"
          className="community-host-banner-messages__action community-host-banner-messages__action--delete"
          aria-label={t('community_host_spotlight_delete', 'Remove message')}
          title={t('community_host_spotlight_delete', 'Remove message')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
        >
          <FaTimes size={13} />
        </button>
      </div>
    ) : null;

  const threadRow = quoted ? (
    <div className="community-host-banner-messages__thread-row" dir={contentDir}>
      <div className="community-host-banner-messages__thread-avatar">
        <UserAvatar
          user={{
            photo_url: quoted.senderAvatar,
            display_name: quoted.senderName,
            gender: quoted.senderGender,
          }}
          className="community-host-banner-messages__thread-avatar-img"
          alt=""
        />
      </div>

      <div className="community-host-banner-messages__thread-bubbles">
        <div className="community-host-banner-messages__guest-layer">
          <SpotlightBubble
            message={quoted}
            t={t}
            language={language}
            className="community-host-banner-messages__bubble--quoted community-host-banner-messages__bubble--guest"
          />
        </div>

        {hasReply ? (
          <div className="community-host-banner-messages__reply-layer">
            <SpotlightBubble
              message={message}
              t={t}
              language={language}
              className="community-host-banner-messages__bubble--host-reply"
            />
          </div>
        ) : null}

        {hasPendingOnly ? (
          <AppText as="span" className="community-host-banner-messages__pending-hint">
            {t('community_chat_reply_composing', 'Type your reply below…')}
          </AppText>
        ) : null}
      </div>
    </div>
  ) : null;

  const singleBubble =
    !showThreadLayout && message ? (
      <SpotlightBubble message={message} t={t} language={language} />
    ) : null;

  return (
    <>
      {showThreadLayout ? threadRow : singleBubble}
      {actionBar}
    </>
  );
}

function CommunityHostSpotlightItem({
  view,
  hasTitle,
  editable,
  selected,
  onSelectChange,
  contentDir,
  language,
  t,
  onDelete,
  onPositionChange,
}) {
  const snapshot = buildSpotlightSnapshot(view);
  const message = snapshot.message;

  if (!message) {
    const pendingPos = resolveNewHostSpotlightPosition({ hasTitle });
    return (
      <div className="community-host-banner-messages__spotlight-layer community-host-banner-messages__spotlight-layer--enter">
        <div
          className="community-host-banner-messages__spotlight-anchor community-host-banner-messages__spotlight-anchor--pending"
          style={{
            left: `${pendingPos.x}%`,
            top: `${pendingPos.y}%`,
          }}
        >
          <div
            className="community-host-banner-messages__spotlight community-host-banner-messages__spotlight--thread community-host-banner-messages__spotlight--pending"
            dir={contentDir}
          >
            <BannerSpotlightContent
              snapshot={snapshot}
              contentDir={contentDir}
              language={language}
              t={t}
              editable={false}
              selected={false}
              onDelete={() => {}}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <CommunityHostSpotlightItemDraggable
      snapshot={snapshot}
      message={message}
      hasTitle={hasTitle}
      editable={editable}
      selected={selected}
      onSelectChange={onSelectChange}
      contentDir={contentDir}
      language={language}
      t={t}
      onDelete={onDelete}
      onPositionChange={onPositionChange}
    />
  );
}

function CommunityHostSpotlightItemDraggable({
  snapshot,
  message,
  hasTitle,
  editable,
  selected,
  onSelectChange,
  contentDir,
  language,
  t,
  onDelete,
  onPositionChange,
}) {
  const isBigEmoji = message?.type === 'emoji-big';
  const isImage = message?.type === 'image';
  const isAudio = isAudioMessage(message);
  const showThreadLayout = snapshot.showThreadLayout;

  const [enterAnim] = useState(() => pickHostSpotlightEnterAnimation());
  const dragEnabled = editable && Boolean(message?.id);

  const handleSelectChange = useCallback(
    (action) => {
      if (action === 'clear') {
        onSelectChange?.(null);
        return;
      }
      if (action === 'toggle') {
        onSelectChange?.(snapshot.key);
      }
    },
    [onSelectChange, snapshot.key]
  );

  const {
    anchorRef,
    localPos,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useHostSpotlightDrag({
    message,
    hasTitle,
    editable: dragEnabled,
    selected,
    onSelectChange: handleSelectChange,
    onPositionChange,
  });

  const handleDelete = (event) => {
    event.stopPropagation();
    void onDelete?.(message.id);
  };

  return (
    <div className="community-host-banner-messages__spotlight-layer community-host-banner-messages__spotlight-layer--enter">
      <div
        ref={anchorRef}
        className={`community-host-banner-messages__spotlight-anchor${showThreadLayout ? ' community-host-banner-messages__spotlight-anchor--thread' : ''}${dragging ? ' community-host-banner-messages__spotlight-anchor--dragging' : ''}${selected ? ' community-host-banner-messages__spotlight-anchor--selected' : ''}${dragEnabled ? ' community-host-banner-messages__spotlight-anchor--draggable' : ''}`}
        style={{
          left: `${localPos.x}%`,
          top: `${localPos.y}%`,
        }}
        onPointerDown={dragEnabled ? handlePointerDown : undefined}
        onPointerMove={dragEnabled ? handlePointerMove : undefined}
        onPointerUp={dragEnabled ? handlePointerUp : undefined}
        onPointerCancel={dragEnabled ? handlePointerUp : undefined}
        role={dragEnabled ? 'button' : undefined}
        aria-label={
          dragEnabled
            ? t('community_host_spotlight_drag_hint', 'Drag to move spotlight message')
            : undefined
        }
      >
        <div
          className={`community-host-banner-messages__spotlight${isBigEmoji ? ' community-host-banner-messages__spotlight--emoji' : ''}${isImage ? ' community-host-banner-messages__spotlight--image' : ''}${isAudio ? ' community-host-banner-messages__spotlight--audio' : ''}${showThreadLayout ? ' community-host-banner-messages__spotlight--thread' : ''}${dragEnabled ? ' community-host-banner-messages__spotlight--draggable' : ''}${selected ? ' community-host-banner-messages__spotlight--selected' : ''}${dragging ? ' community-host-banner-messages__spotlight--dragging' : ''} ${hostSpotlightEnterClassName(enterAnim)}`}
          dir={contentDir}
        >
          <BannerSpotlightContent
            snapshot={snapshot}
            contentDir={contentDir}
            language={language}
            t={t}
            editable={editable}
            selected={selected}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}

/** Banner spotlight — latest host bubble only. */
export default function CommunityHostBannerMessages({
  items = [],
  hasTitle = false,
  editable,
  onDelete,
  onPositionChange,
}) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const rootRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  const handleBannerPointerDown = useCallback(
    (event) => {
      if (!editable) return;
      if (event.target.closest('.community-host-banner-messages__spotlight-anchor')) return;
      setSelectedId(null);
    },
    [editable]
  );

  useEffect(() => {
    setSelectedId(null);
  }, [items.map((item) => item.key).join('|')]);

  useEffect(() => {
    if (!editable || !selectedId) return undefined;
    const onOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setSelectedId(null);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [editable, selectedId]);

  if (!items.length) return null;

  const handleSelectChange = (key) => {
    setSelectedId((prev) => (prev === key ? null : key));
  };

  const hasImage = items.some((item) => item.message?.type === 'image');
  const hasAudio = items.some((item) => isAudioMessage(item.message));
  const hasThread = items.some(
    (item) => buildSpotlightSnapshot(item).showThreadLayout
  );

  return (
    <div
      ref={rootRef}
      className={`community-host-banner-messages${hasImage ? ' community-host-banner-messages--image' : ''}${hasAudio ? ' community-host-banner-messages--audio' : ''}${hasThread ? ' community-host-banner-messages--thread' : ''}${editable ? ' community-host-banner-messages--editable' : ''}`}
      role="status"
      aria-label={t('community_host_messages', 'Message from host')}
      onPointerDown={handleBannerPointerDown}
    >
      {items.map((view) => (
        <CommunityHostSpotlightItem
          key={view.key}
          view={view}
          hasTitle={hasTitle}
          editable={editable}
          selected={selectedId === view.key}
          onSelectChange={(key) => {
            if (key === null) setSelectedId(null);
            else handleSelectChange(key);
          }}
          contentDir={contentDir}
          language={i18n.language}
          t={t}
          onDelete={onDelete}
          onPositionChange={onPositionChange}
        />
      ))}
    </div>
  );
}
