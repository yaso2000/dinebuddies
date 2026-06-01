import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaBan } from 'react-icons/fa';
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

function ToneIcon({ toneId }) {
    if (toneId === 'light') {
        return <span className="private-card-text-backdrop-tone__swatch private-card-text-backdrop-tone__swatch--light" aria-hidden />;
    }
    if (toneId === 'dark') {
        return <span className="private-card-text-backdrop-tone__swatch private-card-text-backdrop-tone__swatch--dark" aria-hidden />;
    }
    return <FaBan aria-hidden className="private-card-text-backdrop-tone__ban-icon" />;
}

/** Dark / light / none — shown only when “show text on card” is on. */
export default function PrivateCardTextBackdropTonePicker({
    tone = 'dark',
    onToneChange,
    disabled = false,
    /** `default` | `on-panel` | `on-preview-top` | `icons` */
    variant = 'default',
    toneOrder = PRIVATE_TEXT_BACKDROP_TONE_IDS
}) {
    const { t } = useTranslation();
    const current = resolvePrivateTextBackdropTone(tone);
    const isIcons = variant === 'icons';

    return (
        <div
            className={`private-card-text-backdrop-tone${
                variant === 'on-panel'
                    ? ' private-card-text-backdrop-tone--on-panel'
                    : variant === 'on-preview-top'
                      ? ' private-card-text-backdrop-tone--on-preview-top'
                      : isIcons
                        ? ' private-card-text-backdrop-tone--icons'
                        : ''
            }`}
            role="group"
            aria-label={t('private_card_text_backdrop_tone_aria', { defaultValue: 'Text panel tone' })}
        >
            {variant === 'default' ? (
                <span className="private-card-text-backdrop-tone__label">
                    {t('private_card_text_backdrop_tone_label', { defaultValue: 'Panel' })}
                </span>
            ) : null}
            {toneOrder.map((id) => {
                const selected = current === id;
                const label = t(TONE_LABEL_KEYS[id], { defaultValue: TONE_DEFAULTS[id] });
                return (
                    <button
                        key={id}
                        type="button"
                        className={`private-card-text-backdrop-tone__chip${
                            selected ? ' private-card-text-backdrop-tone__chip--sel' : ''
                        }${id === 'light' && !isIcons ? ' private-card-text-backdrop-tone__chip--light' : ''}${
                            id === 'none' && !isIcons ? ' private-card-text-backdrop-tone__chip--none' : ''
                        }${isIcons ? ' private-card-text-backdrop-tone__chip--icon' : ''}`}
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={label}
                        title={label}
                        onClick={() => onToneChange?.(id)}
                    >
                        {isIcons ? <ToneIcon toneId={id} /> : label}
                    </button>
                );
            })}
        </div>
    );
}
