import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaPalette } from 'react-icons/fa';
import { AppText } from '../base';
import { CHAT_THEME_IDS, CHAT_THEMES } from '../../constants/chatThemes';
import './ChatThemePicker.css';

export default function ChatThemePicker({
  value,
  onChange,
  className = '',
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const isArabic = i18n.language?.toLowerCase().startsWith('ar');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleLabel = t('chat_theme_toggle', isArabic ? 'ثيمات المحادثة' : 'Chat themes');
  const menuTitle = t('chat_theme_menu', isArabic ? 'اختر ثيم المحادثة' : 'Choose a chat theme');

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`chat-theme-picker${className ? ` ${className}` : ''}${open ? ' chat-theme-picker--open' : ''}`}
    >
      <button
        type="button"
        className="chat-theme-picker__toggle"
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <FaPalette size={16} aria-hidden />
      </button>

      {open ? (
        <div
          className={`chat-theme-picker__menu${isRtl ? ' chat-theme-picker__menu--rtl' : ' chat-theme-picker__menu--ltr'}`}
          role="menu"
          aria-label={menuTitle}
        >
          <AppText as="div" className="chat-theme-picker__title" dir="auto">
            {menuTitle}
          </AppText>
          <div className="chat-theme-picker__grid">
            {CHAT_THEME_IDS.map((themeId) => {
              const theme = CHAT_THEMES[themeId];
              const selected = themeId === value;
              const label = isArabic ? (theme.labelAr || theme.labelDefault) : t(theme.labelKey, theme.labelDefault);

              return (
                <button
                  key={themeId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`chat-theme-picker__option${selected ? ' chat-theme-picker__option--active' : ''}`}
                  onClick={() => {
                    onChange?.(themeId);
                    setOpen(false);
                  }}
                >
                  <span
                    className="chat-theme-picker__swatch"
                    style={{ background: theme.swatch }}
                    aria-hidden
                  />
                  <AppText as="span" className="chat-theme-picker__label" dir="auto">
                    {label}
                  </AppText>
                  {selected ? <FaCheck size={11} className="chat-theme-picker__check" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
