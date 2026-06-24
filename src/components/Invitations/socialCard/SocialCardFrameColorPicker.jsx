import React from 'react';
import { useTranslation } from 'react-i18next';
import { SOCIAL_CARD_FRAME_COLORS, DEFAULT_FRAME_COLOR_ID } from './socialCardFrameColors';

/**
 * Curated frame color chips for private invitation card preview (no media upload logic).
 */import { AppText } from "../../base";
export default function PrivateCardFrameColorPicker({
  value = DEFAULT_FRAME_COLOR_ID,
  onChange,
  disabled = false,
  className = ''
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`private-card-frame-picker ${className}`.trim()}
      role="group"
      aria-label={t('social_card_frame_text_label', { defaultValue: 'Frame & text' })}>
      
            <AppText as="p" className="private-card-frame-picker__label">
                {t('social_card_frame_text_label', { defaultValue: 'Frame & text' })}
            </AppText>
            <div className="private-card-frame-picker__chips">
                {SOCIAL_CARD_FRAME_COLORS.map((c) => {
          const selected = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(c.id)}
              className={`private-card-frame-picker__chip ${selected ? 'private-card-frame-picker__chip--selected' : ''}`}
              style={{
                borderColor: c.border,
                boxShadow: selected ? c.shadow : 'none'
              }}
              title={t(c.labelKey, { defaultValue: c.defaultLabel })}
              aria-pressed={selected}
              aria-label={t(c.labelKey, { defaultValue: c.defaultLabel })}>
              
                            <AppText as="span" className="private-card-frame-picker__swatch" style={{ background: c.border }} />
                            <AppText as="span" className="private-card-frame-picker__name">{t(c.labelKey, { defaultValue: c.defaultLabel })}</AppText>
                        </button>);

        })}
            </div>
        </div>);

}