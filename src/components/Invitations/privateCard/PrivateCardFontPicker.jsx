import React from 'react';
import { useTranslation } from 'react-i18next';
import { PRIVATE_CARD_FONTS, DEFAULT_FONT_ID } from './privateCardFonts';
import './PrivateCardFontPicker.css';

export default function PrivateCardFontPicker({
    value = DEFAULT_FONT_ID,
    onChange,
    disabled = false,
    className = ''
}) {
    const { t } = useTranslation();

    return (
        <div className={`private-card-font-picker ${className}`.trim()} role="group" aria-label={t('private_card_font_label', { defaultValue: 'Font' })}>
            <p className="private-card-font-picker__label">{t('private_card_font_label', { defaultValue: 'Font' })}</p>
            <div className="private-card-font-picker__chips">
                {PRIVATE_CARD_FONTS.map((f) => {
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
                            aria-pressed={selected}
                        >
                            {t(f.labelKey, { defaultValue: f.defaultLabel })}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
