import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFont } from 'react-icons/fa';
import { PRIVATE_CARD_FONTS } from './privateCardFonts';
import DatingCardThemeColorPanel from './DatingCardThemeColorPanel';
import './DatingCardTypographyBars.css';

/**
 * Toggle icon → compact horizontal font + color strips.
 * `below`: directly under the card preview (not overlaid).
 * Pass `open` + `hideToggle` when the toggle lives on the preview rail.
 */
export default function DatingCardTypographyBars({
    fontId,
    themeColorHex = null,
    onFontChange,
    onThemeColorChange,
    variant = 'default',
    open: controlledOpen,
    onOpenChange,
    hideToggle = false
}) {
    const { t } = useTranslation();
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (next) => {
        if (isControlled) {
            onOpenChange?.(next);
        } else {
            setInternalOpen(next);
        }
    };
    const isBelow = variant === 'below';

    if (hideToggle && !open) {
        return null;
    }

    return (
        <div
            className={`dating-card-typography-bars${
                isBelow ? ' dating-card-typography-bars--below' : ''
            }${open ? ' dating-card-typography-bars--open' : ''}`}
        >
            {!hideToggle ? (
                <button
                    type="button"
                    className={`dating-card-typography-bars__toggle${open ? ' dating-card-typography-bars__toggle--open' : ''}`}
                    onClick={() => setOpen(!open)}
                    aria-expanded={open}
                    aria-label={t('dating_card_style_btn', { defaultValue: 'Font & card color' })}
                    title={t('dating_card_style_btn', { defaultValue: 'Font & card color' })}
                >
                    <FaFont aria-hidden />
                </button>
            ) : null}

            {open ? (
                <div className="dating-card-typography-bars__panels">
                    <div
                        className="dating-card-typography-bars__scroll"
                        role="group"
                        aria-label={t('private_card_font_label', { defaultValue: 'Font' })}
                    >
                        {PRIVATE_CARD_FONTS.map((f) => {
                            const selected = fontId === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    className={`dating-card-typography-bars__font-chip${
                                        selected ? ' dating-card-typography-bars__font-chip--sel' : ''
                                    }`}
                                    style={{ fontFamily: f.cssFamily }}
                                    onClick={() => onFontChange?.(f.id)}
                                    aria-pressed={selected}
                                >
                                    {t(f.labelKey, { defaultValue: f.defaultLabel })}
                                </button>
                            );
                        })}
                    </div>

                    <div className="dating-card-typography-bars__scroll dating-card-typography-bars__scroll--colors">
                        <DatingCardThemeColorPanel
                            layout="row"
                            compact
                            valueHex={themeColorHex}
                            onColorChange={onThemeColorChange}
                        />
                        <button
                            type="button"
                            className="dating-card-typography-bars__reset"
                            onClick={() => onThemeColorChange?.(null)}
                        >
                            {t('dating_card_theme_color_reset', { defaultValue: 'Default' })}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
