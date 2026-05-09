import React from 'react';
import { useTranslation } from 'react-i18next';
import { PRIVATE_CARD_MOTIONS, DEFAULT_MOTION_ID } from './privateCardMotions';
import './PrivateCardMotionPicker.css';

export default function PrivateCardMotionPicker({
    value = DEFAULT_MOTION_ID,
    onChange,
    disabled = false,
    className = ''
}) {
    const { t } = useTranslation();

    return (
        <div
            className={`private-card-motion-picker ${className}`.trim()}
            role="group"
            aria-label={t('private_card_motion_label', { defaultValue: 'Text & photo motion' })}
        >
            <p className="private-card-motion-picker__label">
                {t('private_card_motion_label', { defaultValue: 'Text & photo motion' })}
            </p>
            <div className="private-card-motion-picker__chips">
                {PRIVATE_CARD_MOTIONS.map((m) => {
                    const selected = value === m.id;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange?.(m.id)}
                            className={`private-card-motion-picker__chip ${selected ? 'private-card-motion-picker__chip--selected' : ''}`}
                            title={t(m.labelKey, { defaultValue: m.defaultLabel })}
                            aria-pressed={selected}
                        >
                            {t(m.labelKey, { defaultValue: m.defaultLabel })}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
