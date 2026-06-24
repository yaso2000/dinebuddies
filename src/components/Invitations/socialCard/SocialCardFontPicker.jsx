import React from 'react';
import { useTranslation } from 'react-i18next';
import { SOCIAL_CARD_FONTS, DEFAULT_FONT_ID } from './socialCardFonts';
import './SocialCardFontPicker.css';
import { AppText } from "../../base";

export default function PrivateCardFontPicker({
  value = DEFAULT_FONT_ID,
  onChange,
  disabled = false,
  className = ''
}) {
  const { t } = useTranslation();

  return (
    <div className={`private-card-font-picker ${className}`.trim()} role="group" aria-label={t('social_card_font_label', { defaultValue: 'Font' })}>
            <AppText as="p" className="private-card-font-picker__label">{t('social_card_font_label', { defaultValue: 'Font' })}</AppText>
            <div className="private-card-font-picker__chips">
                {SOCIAL_CARD_FONTS.map((f) => {
          const selected = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(f.id)}
              className={`private-card-font-picker__chip ${selected ? 'private-card-font-picker__chip--selected' : ''}`}
              style={{ fontFamily: f.cssFamily }}
              title={t(f.labelKey, { defaultValue: f.defaultLabel })}
              aria-pressed={selected}>
              
                            {t(f.labelKey, { defaultValue: f.defaultLabel })}
                        </button>);

        })}
            </div>
        </div>);

}