import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { PRIVATE_CARD_FONTS } from './privateCardFonts';
import DatingCardThemeColorPanel from './DatingCardThemeColorPanel';
import './PrivateCardDatingTypographySheet.css';

/**
 * Bottom sheet: font + one card color (border + all text) for dating editor.
 */
export default function PrivateCardDatingTypographySheet({
    open,
    onClose,
    fontId,
    /** `#rrggbb` or null — null uses saved frame preset (border + palette text). */
    themeColorHex = null,
    onFontChange,
    onThemeColorChange
}) {
    const { t } = useTranslation();

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="dating-typography-sheet-backdrop" onClick={onClose} role="presentation">
            <div
                className="dating-typography-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dating-typography-sheet-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="dating-typography-sheet__grab" aria-hidden />
                <div className="dating-typography-sheet__head">
                    <h2 id="dating-typography-sheet-title" className="dating-typography-sheet__title">
                        {t('dating_typography_sheet_title', { defaultValue: 'Font & card color' })}
                    </h2>
                    <button type="button" className="dating-typography-sheet__close" onClick={onClose} aria-label={t('close')}>
                        <FaTimes />
                    </button>
                </div>

                <section className="dating-typography-sheet__section">
                    <h3 className="dating-typography-sheet__section-title">{t('private_card_font_label', { defaultValue: 'Font' })}</h3>
                    <div className="dating-typography-sheet__chips">
                        {PRIVATE_CARD_FONTS.map((f) => {
                            const selected = fontId === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    className={`dating-typography-sheet__chip ${selected ? 'dating-typography-sheet__chip--sel' : ''}`}
                                    style={{ fontFamily: f.cssFamily }}
                                    onClick={() => onFontChange?.(f.id)}
                                >
                                    {t(f.labelKey, { defaultValue: f.defaultLabel })}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="dating-typography-sheet__section">
                    <h3 className="dating-typography-sheet__section-title">
                        {t('dating_card_theme_color_label', { defaultValue: 'Card color' })}
                    </h3>
                    <p className="dating-typography-sheet__hint">
                        {t('dating_card_theme_color_hint', {
                            defaultValue: 'One color for the frame and all text. Plain — no shadow on text.'
                        })}
                    </p>
                    <DatingCardThemeColorPanel valueHex={themeColorHex} onColorChange={onThemeColorChange} />
                    <button
                        type="button"
                        className="dating-typography-sheet__text-color-reset dating-typography-sheet__text-color-reset--block"
                        onClick={() => onThemeColorChange?.(null)}
                    >
                        {t('dating_card_theme_color_reset', { defaultValue: 'Use default card colors' })}
                    </button>
                </section>
            </div>
        </div>,
        document.body
    );
}
