import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaArrowUp, FaArrowDown, FaPlus, FaMinus } from 'react-icons/fa';
import {
    CARD_COPY_OFFSET_MAX,
    CARD_COPY_OFFSET_MIN,
    CARD_COPY_WIDTH_MAX,
    CARD_COPY_WIDTH_MIN,
    clampCardCopyOffsetY,
    clampCardCopyWidthPct,
    CARD_COPY_WIDTH_STEP,
} from './privateCardCopyLayout';
import './PrivateCardCopyLayoutRail.css';

export default function PrivateCardCopyLayoutRail({
    copyOffsetY = 0,
    copyWidthPct = 78,
    onCopyOffsetYChange,
    onCopyWidthPctChange,
    disabled = false,
    className = '',
}) {
    const { t } = useTranslation();
    const offset = clampCardCopyOffsetY(copyOffsetY);
    const width = clampCardCopyWidthPct(copyWidthPct);

    const bumpOffset = (delta) => {
        onCopyOffsetYChange?.(clampCardCopyOffsetY(offset + delta));
    };

    const bumpWidth = (delta) => {
        onCopyWidthPctChange?.(clampCardCopyWidthPct(width + delta * CARD_COPY_WIDTH_STEP));
    };

    const buttons = [
        {
            key: 'up',
            icon: FaArrowUp,
            label: t('private_card_copy_move_up', { defaultValue: 'Move text up' }),
            onClick: () => bumpOffset(-1),
            disabled: disabled || offset <= CARD_COPY_OFFSET_MIN,
        },
        {
            key: 'down',
            icon: FaArrowDown,
            label: t('private_card_copy_move_down', { defaultValue: 'Move text down' }),
            onClick: () => bumpOffset(1),
            disabled: disabled || offset >= CARD_COPY_OFFSET_MAX,
        },
        {
            key: 'wider',
            icon: FaPlus,
            label: t('private_card_copy_wider', { defaultValue: 'Wider text area' }),
            onClick: () => bumpWidth(1),
            disabled: disabled || width >= CARD_COPY_WIDTH_MAX,
        },
        {
            key: 'narrower',
            icon: FaMinus,
            label: t('private_card_copy_narrower', { defaultValue: 'Narrower text area' }),
            onClick: () => bumpWidth(-1),
            disabled: disabled || width <= CARD_COPY_WIDTH_MIN,
        },
    ];

    return (
        <div
            className={`private-card-copy-layout-rail ${className}`.trim()}
            role="group"
            aria-label={t('private_card_copy_layout_label', { defaultValue: 'Text position and width' })}
        >
            {buttons.map(({ key, icon: Icon, label, onClick, disabled: btnDisabled }) => (
                <button
                    key={key}
                    type="button"
                    disabled={btnDisabled}
                    onClick={onClick}
                    className="private-card-copy-layout-rail__btn"
                    title={label}
                    aria-label={label}
                >
                    <Icon aria-hidden />
                </button>
            ))}
        </div>
    );
}
