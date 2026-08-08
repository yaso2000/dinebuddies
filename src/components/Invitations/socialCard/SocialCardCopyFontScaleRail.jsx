import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CARD_COPY_FONT_SCALE_MAX,
  CARD_COPY_FONT_SCALE_MIN,
  clampCardCopyFontScale } from
'./socialCardCopyLayout';
import './SocialCardCopyFontScaleRail.css';
import { AppText } from "../../base";

export default function PrivateCardCopyFontScaleRail({
  copyFontScale = 0,
  onCopyFontScaleChange,
  disabled = false,
  className = ''
}) {
  const { t } = useTranslation();
  const scale = clampCardCopyFontScale(copyFontScale);

  const bumpScale = (delta) => {
    onCopyFontScaleChange?.(clampCardCopyFontScale(scale + delta));
  };

  const buttons = [
  {
    key: 'larger',
    label: t('social_card_copy_font_larger', { defaultValue: 'Larger title and message' }),
    text: 'A+',
    onClick: () => bumpScale(1),
    disabled: disabled || scale >= CARD_COPY_FONT_SCALE_MAX
  },
  {
    key: 'smaller',
    label: t('social_card_copy_font_smaller', { defaultValue: 'Smaller title and message' }),
    text: 'A−',
    onClick: () => bumpScale(-1),
    disabled: disabled || scale <= CARD_COPY_FONT_SCALE_MIN
  }];


  return (
    <div
      className={`private-card-copy-font-scale-rail ${className}`.trim()}
      role="group"
      aria-label={t('social_card_copy_font_scale_label', { defaultValue: 'Title and message size' })}>

            {buttons.map(({ key, label, text, onClick, disabled: btnDisabled }) =>
      <button
        key={key}
        type="button"
        disabled={btnDisabled}
        onClick={onClick}
        className="private-card-copy-font-scale-rail__btn"
        title={label}
        aria-label={label}>

                    <AppText as="span" aria-hidden>{text}</AppText>
                </button>
      )}
        </div>);

}