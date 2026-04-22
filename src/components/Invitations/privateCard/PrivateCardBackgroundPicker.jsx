import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCardBackgroundOptions, resolveCardBackgroundUrlCandidates } from './privateCardBackgrounds';
import './PrivateCardBackgroundPicker.css';

function PrivateCardBgThumb({ categoryId, optionId, selected, onClick, title }) {
    const candidates = useMemo(
        () => resolveCardBackgroundUrlCandidates(categoryId, optionId),
        [categoryId, optionId]
    );
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        setIdx(0);
    }, [categoryId, optionId]);

    const url = candidates[idx];

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            className={`private-card-bg-picker__thumb${selected ? ' private-card-bg-picker__thumb--selected' : ''}`}
            onClick={onClick}
            title={title}
        >
            {url ? (
                <img
                    className="private-card-bg-picker__thumb-img"
                    src={url}
                    alt=""
                    draggable={false}
                    onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
                />
            ) : null}
        </button>
    );
}

export default function PrivateCardBackgroundPicker({ categoryId, value, onChange }) {
    const { t } = useTranslation();
    const options = getCardBackgroundOptions(categoryId);

    if (!options.length) return null;

    return (
        <div className="private-card-bg-picker">
            <p className="private-card-bg-picker__label">
                {t('private_card_background_label', { defaultValue: 'Card background' })}
            </p>
            <div className="private-card-bg-picker__row" role="radiogroup" aria-label={t('private_card_background_label', { defaultValue: 'Card background' })}>
                {options.map((opt) => {
                    const selected =
                        value === opt.id ||
                        (opt.id === 'birthday-candlecake' && value === 'birthday-candlake');
                    return (
                        <PrivateCardBgThumb
                            key={opt.id}
                            categoryId={categoryId}
                            optionId={opt.id}
                            selected={selected}
                            onClick={() => onChange(opt.id)}
                            title={t(`card_bg_${opt.id.replace(/-/g, '_')}`, { defaultValue: opt.id })}
                        />
                    );
                })}
            </div>
        </div>
    );
}
