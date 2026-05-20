import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    PRIVATE_TEXT_BACKDROP_TONE_IDS,
    resolvePrivateTextBackdropTone
} from './privateCardTextBackdrop';
import './PrivateCardTextBackdropTonePicker.css';

const TONE_LABEL_KEYS = {
    dark: 'private_card_text_backdrop_tone_dark',
    light: 'private_card_text_backdrop_tone_light',
    none: 'private_card_text_backdrop_tone_none'
};

const TONE_DEFAULTS = {
    dark: 'Dark',
    light: 'Light',
    none: 'None'
};

/** Dark / light / none — shown only when “show text on card” is on. */
export default function PrivateCardTextBackdropTonePicker({ tone = 'dark', onToneChange, disabled = false }) {
    const { t } = useTranslation();
    const current = resolvePrivateTextBackdropTone(tone);

    return (
        <div
            className="private-card-text-backdrop-tone"
            role="group"
            aria-label={t('private_card_text_backdrop_tone_aria', { defaultValue: 'Text panel tone' })}
        >
            <span className="private-card-text-backdrop-tone__label">
                {t('private_card_text_backdrop_tone_label', { defaultValue: 'Panel' })}
            </span>
            {PRIVATE_TEXT_BACKDROP_TONE_IDS.map((id) => {
                const selected = current === id;
                return (
                    <button
                        key={id}
                        type="button"
                        className={`private-card-text-backdrop-tone__chip${
                            selected ? ' private-card-text-backdrop-tone__chip--sel' : ''
                        }${id === 'light' ? ' private-card-text-backdrop-tone__chip--light' : ''}${
                            id === 'none' ? ' private-card-text-backdrop-tone__chip--none' : ''
                        }`}
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => onToneChange?.(id)}
                    >
                        {t(TONE_LABEL_KEYS[id], { defaultValue: TONE_DEFAULTS[id] })}
                    </button>
                );
            })}
        </div>
    );
}
