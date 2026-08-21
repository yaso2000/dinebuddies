import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEllipsisV } from 'react-icons/fa';
import { AppText } from '../base';
import CommunityChatBannerToggle from './CommunityChatBannerToggle';
import './CommunityChatHeaderMenu.css';

/**
 * Overflow menu for community / stage chat header.
 * Keeps close + identity visible; banner and room actions live here.
 * Bubble colors are controlled by the host Chat look tool, not this menu.
 */
export default function CommunityChatHeaderMenu({
  bannerChecked,
  bannerDisabled = false,
  bannerPersonal = false,
  onBannerChange,
  actions = [],
  inline = false,
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const menuLabel = t('community_chat_header_menu', 'Chat options');
  const visibleActionsInline = (actions || []).filter(Boolean);

  if (inline) {
    return (
      <div className="community-chat-header-menu community-chat-header-menu--inline">
        <CommunityChatBannerToggle
          checked={bannerChecked}
          disabled={bannerDisabled}
          personal={bannerPersonal}
          onChange={onBannerChange}
        />
        {visibleActionsInline.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`community-chat-header-menu__action community-chat-header-menu__action--inline${action.danger ? ' community-chat-header-menu__action--danger' : ''}`}
            disabled={action.disabled}
            onClick={() => void action.onClick?.()}
          >
            {action.icon ? <span className="community-chat-header-menu__action-icon">{action.icon}</span> : null}
            <AppText as="span">{action.label}</AppText>
          </button>
        ))}
      </div>
    );
  }

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const visibleActions = (actions || []).filter(Boolean);

  return (
    <div
      ref={rootRef}
      className={`community-chat-header-menu${open ? ' community-chat-header-menu--open' : ''}`}
    >
      <button
        type="button"
        className="header-menu-btn community-chat-header-menu__toggle"
        aria-label={menuLabel}
        title={menuLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        <FaEllipsisV size={18} aria-hidden />
      </button>

      {open ? (
        <div
          className={`community-chat-header-menu__panel${isRtl ? ' community-chat-header-menu__panel--rtl' : ' community-chat-header-menu__panel--ltr'}`}
          role="menu"
          aria-label={menuLabel}
        >
          <div className="community-chat-header-menu__section">
            <CommunityChatBannerToggle
              checked={bannerChecked}
              disabled={bannerDisabled}
              personal={bannerPersonal}
              onChange={onBannerChange}
            />
          </div>

          {visibleActions.length ? (
            <div className="community-chat-header-menu__section community-chat-header-menu__section--actions">
              {visibleActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  className={`community-chat-header-menu__action${action.danger ? ' community-chat-header-menu__action--danger' : ''}`}
                  disabled={action.disabled}
                  onClick={() => {
                    void action.onClick?.();
                    if (!action.keepOpen) setOpen(false);
                  }}
                >
                  {action.icon ? <span className="community-chat-header-menu__action-icon">{action.icon}</span> : null}
                  <AppText as="span">{action.label}</AppText>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
