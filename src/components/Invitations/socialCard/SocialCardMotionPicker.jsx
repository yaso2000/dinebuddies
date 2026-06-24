import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaBan, FaHeart, FaSyncAlt, FaChevronUp } from 'react-icons/fa';
import { SOCIAL_CARD_MOTIONS, DEFAULT_MOTION_ID } from './socialCardMotions';
import './SocialCardMotionPicker.css';
import { AppText } from "../../base";

const MOTION_ICONS = {
  none: FaBan,
  sway: FaSyncAlt,
  pulse: FaHeart,
  float: FaChevronUp
};

export default function PrivateCardMotionPicker({
  value = DEFAULT_MOTION_ID,
  onChange,
  disabled = false,
  className = '',
  /** `default` | `rail` — rail = vertical icon strip on preview right edge */
  variant = 'default'
}) {
  const { t } = useTranslation();
  const isRail = variant === 'rail';

  return (
    <div
      className={`private-card-motion-picker${
      isRail ? ' private-card-motion-picker--rail' : ''} ${
      className}`.trim()}
      role="group"
      aria-label={t('social_card_motion_label', { defaultValue: 'Text & photo motion' })}>

            {!isRail ?
      <AppText as="p" className="private-card-motion-picker__label">
                    {t('social_card_motion_label', { defaultValue: 'Text & photo motion' })}
                </AppText> :
      null}
            <div className="private-card-motion-picker__chips">
                {SOCIAL_CARD_MOTIONS.map((m) => {
          const selected = value === m.id;
          const Icon = MOTION_ICONS[m.id];
          const label = t(m.labelKey, { defaultValue: m.defaultLabel });
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(m.id)}
              className={`private-card-motion-picker__chip ${
              selected ? 'private-card-motion-picker__chip--selected' : ''}${
              isRail ? ' private-card-motion-picker__chip--icon' : ''}`}
              title={label}
              aria-label={label}
              aria-pressed={selected}>

                            {isRail && Icon ? <Icon aria-hidden /> : label}
                        </button>);

        })}
            </div>
        </div>);

}