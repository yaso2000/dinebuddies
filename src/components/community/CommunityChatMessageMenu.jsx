import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaBullhorn, FaImage, FaReply, FaThumbtack, FaTrash, FaVolumeMute } from 'react-icons/fa';
import { AppText } from '../base';
import { getAppTextDirection } from '../../utils/bidiText';

export default function CommunityChatMessageMenu({
  open,
  anchorRect,
  showReply,
  showMute,
  showPin,
  showUnpin,
  showOnBanner,
  showHideFromBanner,
  showDelete,
  onReply,
  onMute,
  onPin,
  onUnpin,
  onShowOnBanner,
  onHideFromBanner,
  onDelete,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open, onClose]);

  if (!open || !anchorRect || typeof document === 'undefined') return null;

  const top = Math.max(8, anchorRect.top - 8);
  const left = Math.min(
    window.innerWidth - 168,
    Math.max(8, anchorRect.left + anchorRect.width / 2 - 84)
  );

  return createPortal(
    <div
      ref={menuRef}
      className="community-chat-message-menu"
      style={{ top, left }}
      dir={contentDir}
      role="menu"
    >
      {showReply ? (
        <button
          type="button"
          className="community-chat-message-menu__item"
          role="menuitem"
          onClick={() => {
            onReply?.();
            onClose?.();
          }}
        >
          <FaReply size={14} aria-hidden />
          <AppText as="span">{t('community_chat_reply', 'Reply')}</AppText>
        </button>
      ) : null}
      {showMute ? (
        <button
          type="button"
          className="community-chat-message-menu__item"
          role="menuitem"
          onClick={() => {
            onMute?.();
            onClose?.();
          }}
        >
          <FaVolumeMute size={14} aria-hidden />
          <AppText as="span">{t('mute_member', 'Mute')}</AppText>
        </button>
      ) : null}
      {showPin ? (
        <button
          type="button"
          className="community-chat-message-menu__item"
          role="menuitem"
          onClick={() => {
            onPin?.();
            onClose?.();
          }}
        >
          <FaThumbtack size={14} aria-hidden />
          <AppText as="span">{t('community_chat_pin_bar', 'Pin to announcement bar')}</AppText>
        </button>
      ) : null}
      {showUnpin ? (
        <button
          type="button"
          className="community-chat-message-menu__item"
          role="menuitem"
          onClick={() => {
            onUnpin?.();
            onClose?.();
          }}
        >
          <FaThumbtack size={14} aria-hidden />
          <AppText as="span">{t('community_chat_unpin_bar', 'Unpin from bar')}</AppText>
        </button>
      ) : null}
      {showOnBanner ? (
        <button
          type="button"
          className="community-chat-message-menu__item"
          role="menuitem"
          onClick={() => {
            onShowOnBanner?.();
            onClose?.();
          }}
        >
          <FaImage size={14} aria-hidden />
          <AppText as="span">{t('community_chat_show_on_banner', 'Show on banner')}</AppText>
        </button>
      ) : null}
      {showHideFromBanner ? (
        <button
          type="button"
          className="community-chat-message-menu__item"
          role="menuitem"
          onClick={() => {
            onHideFromBanner?.();
            onClose?.();
          }}
        >
          <FaBullhorn size={14} aria-hidden />
          <AppText as="span">{t('community_chat_hide_from_banner', 'Hide from banner')}</AppText>
        </button>
      ) : null}
      {showDelete ? (
        <button
          type="button"
          className="community-chat-message-menu__item community-chat-message-menu__item--danger"
          role="menuitem"
          onClick={() => {
            onDelete?.();
            onClose?.();
          }}
        >
          <FaTrash size={14} aria-hidden />
          <AppText as="span">{t('delete', 'Delete')}</AppText>
        </button>
      ) : null}
    </div>,
    document.body
  );
}
