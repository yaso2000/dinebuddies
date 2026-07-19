import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaEllipsisV, FaPalette } from 'react-icons/fa';
import { AppText } from '../base';
import { CHAT_THEME_IDS, CHAT_THEMES } from '../../constants/chatThemes';
import CommunityChatBannerToggle from './CommunityChatBannerToggle';
import './CommunityChatHeaderMenu.css';

/**
 * Overflow menu for community / stage chat header.
 * Keeps close + identity visible; themes, banner, and room actions live here.
 */
export default function CommunityChatHeaderMenu({
  themeId,
  onThemeChange,
  bannerChecked,
  bannerDisabled = false,
  bannerPersonal = false,
  onBannerChange,
  actions = [],
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const isArabic = i18n.language?.toLowerCase().startsWith('ar');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const menuLabel = t('community_chat_header_menu', 'Chat options');
  const themesTitle = t('chat_theme_menu', isArabic ? 'اختر ثيم المحادثة' : 'Choose a chat theme');

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

          <div className="community-chat-header-menu__section">
            <div className="community-chat-header-menu__section-title">
              <FaPalette size={12} aria-hidden />
              <AppText as="span" dir="auto">
                {themesTitle}
              </AppText>
            </div>
            <div className="community-chat-header-menu__theme-grid">
              {CHAT_THEME_IDS.map((id) => {
                const theme = CHAT_THEMES[id];
                const selected = id === themeId;
                const label = isArabic
                  ? theme.labelAr || theme.labelDefault
                  : t(theme.labelKey, theme.labelDefault);

                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={`community-chat-header-menu__theme${selected ? ' community-chat-header-menu__theme--active' : ''}`}
                    onClick={() => onThemeChange?.(id)}
                  >
                    <span
                      className="community-chat-header-menu__swatch"
                      style={{ background: theme.swatch }}
                      aria-hidden
                    />
                    <AppText as="span" className="community-chat-header-menu__theme-label" dir="auto">
                      {label}
                    </AppText>
                    {selected ? (
                      <FaCheck size={11} className="community-chat-header-menu__check" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
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
