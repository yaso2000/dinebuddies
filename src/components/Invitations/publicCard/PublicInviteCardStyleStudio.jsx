import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';
import { COLOR_SCHEMES } from '../../../utils/invitationTemplates';
import { PUBLIC_INVITATION_FONT_OPTIONS } from '../../../utils/aiInvitationThemeBinding';
import { useDragScrollRail } from '../../../hooks/useDragScrollRail';
import './PublicInviteCardStyleStudio.css';

/**
 * Colors (small dots) → fonts (horizontal drag) → preview (children).
 */
export default function PublicInviteCardStyleStudio({
    colorScheme,
    onColorSchemeChange,
    cardFontFamily = '',
    onCardFontFamilyChange,
    children,
}) {
    const { t } = useTranslation();

    const {
        railRef: colorRailRef,
        isDragging: colorDragging,
        onPointerDown: onColorDown,
        onPointerMove: onColorMove,
        onPointerUp: onColorUp,
        onPointerCancel: onColorCancel,
        wasDragged: colorWasDragged,
        scrollItemIntoView: scrollColorIntoView,
    } = useDragScrollRail();

    const {
        railRef: fontRailRef,
        isDragging: fontDragging,
        onPointerDown: onFontDown,
        onPointerMove: onFontMove,
        onPointerUp: onFontUp,
        onPointerCancel: onFontCancel,
        wasDragged: fontWasDragged,
        scrollItemIntoView: scrollFontIntoView,
    } = useDragScrollRail();

    const selectColor = (key, el) => {
        onColorSchemeChange?.(key);
        if (el) scrollColorIntoView(el);
    };

    const selectFont = (cssFamily, el) => {
        onCardFontFamilyChange?.(cssFamily);
        if (el) scrollFontIntoView(el);
    };

    return (
        <div className="public-invite-style-studio">
            <div
                ref={colorRailRef}
                className={`public-invite-style-studio__colors${colorDragging ? ' is-dragging' : ''}`}
                role="listbox"
                aria-label={t('choose_color_theme', { defaultValue: 'Choose Color Theme' })}
                onPointerDown={onColorDown}
                onPointerMove={onColorMove}
                onPointerUp={onColorUp}
                onPointerCancel={onColorCancel}
            >
                {Object.entries(COLOR_SCHEMES).map(([key, color]) => {
                    const isSelected = colorScheme === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`public-invite-style-studio__color-dot${isSelected ? ' is-selected' : ''}`}
                            style={{
                                background: color.gradient,
                                boxShadow: isSelected ? `0 2px 8px ${color.shadow}` : '0 1px 4px rgba(0,0,0,0.12)',
                            }}
                            onClick={(e) => {
                                if (colorWasDragged()) return;
                                selectColor(key, e.currentTarget);
                            }}
                            title={key}
                        >
                            {isSelected && (
                                <span className="public-invite-style-studio__color-dot__check" aria-hidden>
                                    <FaCheckCircle />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div
                ref={fontRailRef}
                className={`public-invite-style-studio__fonts${fontDragging ? ' is-dragging' : ''}`}
                role="listbox"
                aria-label={t('invitation_card_font', { defaultValue: 'Title & message font' })}
                onPointerDown={onFontDown}
                onPointerMove={onFontMove}
                onPointerUp={onFontUp}
                onPointerCancel={onFontCancel}
            >
                <button
                    type="button"
                    role="option"
                    aria-selected={!cardFontFamily}
                    className={`public-invite-style-studio__font-chip${!cardFontFamily ? ' is-selected' : ''}`}
                    onClick={(e) => {
                        if (fontWasDragged()) return;
                        selectFont('', e.currentTarget);
                    }}
                >
                    {t('invitation_font_default', { defaultValue: 'Default' })}
                </button>
                {PUBLIC_INVITATION_FONT_OPTIONS.map((f) => {
                    const sel = cardFontFamily === f.cssFamily;
                    return (
                        <button
                            key={f.label}
                            type="button"
                            role="option"
                            aria-selected={sel}
                            className={`public-invite-style-studio__font-chip${sel ? ' is-selected' : ''}`}
                            style={{ fontFamily: f.cssFamily }}
                            onClick={(e) => {
                                if (fontWasDragged()) return;
                                selectFont(f.cssFamily, e.currentTarget);
                            }}
                            title={f.label}
                        >
                            {f.label}
                        </button>
                    );
                })}
            </div>

            <div className="public-invite-style-studio__preview">{children}</div>
        </div>
    );
}
