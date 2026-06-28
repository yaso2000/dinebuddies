import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage } from 'react-icons/fa';
import { AppText } from '../base';
import './CommunityChatBannerToggle.css';

/** Header switch — host controls banner for everyone; members can hide it locally. */
export default function CommunityChatBannerToggle({
  checked,
  onChange,
  disabled = false,
  personal = false,
}) {
  const { t } = useTranslation();
  const label = checked
    ? t('community_chat_banner_toggle_on', 'Banner on')
    : t('community_chat_banner_toggle_off', 'Banner off');
  const hint = personal
    ? t('community_chat_banner_toggle_hint_guest', 'Show or hide the top media banner on your device')
    : t('community_chat_banner_toggle_hint', 'Show or hide the top media banner for everyone');

  return (
    <label
      className="community-chat-banner-toggle"
      title={hint}
    >
      <FaImage size={14} className="community-chat-banner-toggle__icon" aria-hidden />
      <AppText as="span" className="community-chat-banner-toggle__label">
        {label}
      </AppText>
      <span className="community-chat-banner-toggle__switch toggle-switch small">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="toggle-slider" />
      </span>
    </label>
  );
}
