import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { SOCIAL_CARD_FONTS } from './socialCardFonts';
import PrivateCardThemeColorPanel from './PrivateCardThemeColorPanel';
import './SocialCardPrivateTypographySheet.css';

/**
 * Bottom sheet: font + one card color (border + all text) for dating editor.
 */import { AppText } from "../../base";
export default function PrivateCardTypographySheet({
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
    <div className="private-typography-sheet-backdrop" onClick={onClose} role="presentation">
            <div
        className="private-typography-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="private-typography-sheet-title"
        onClick={(e) => e.stopPropagation()}>

                <div className="private-typography-sheet__grab" aria-hidden />
                <div className="private-typography-sheet__head">
                    <AppText as="h2" id="private-typography-sheet-title" className="private-typography-sheet__title">
                        {t('private_typography_sheet_title', { defaultValue: 'Font & card color' })}
                    </AppText>
                    <button type="button" className="private-typography-sheet__close" onClick={onClose} aria-label={t('close')}>
                        <FaTimes />
                    </button>
                </div>

                <section className="private-typography-sheet__section">
                    <AppText as="h3" className="private-typography-sheet__section-title">{t('social_card_font_label', { defaultValue: 'Font' })}</AppText>
                    <div className="private-typography-sheet__chips">
                        {SOCIAL_CARD_FONTS.map((f) => {
              const selected = fontId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`private-typography-sheet__chip ${selected ? 'private-typography-sheet__chip--sel' : ''}`}
                  style={{ fontFamily: f.cssFamily }}
                  onClick={() => onFontChange?.(f.id)}>

                                    {t(f.labelKey, { defaultValue: f.defaultLabel })}
                                </button>);

            })}
                    </div>
                </section>

                <section className="private-typography-sheet__section">
                    <AppText as="h3" className="private-typography-sheet__section-title">
                        {t('private_card_theme_color_label', { defaultValue: 'Card color' })}
                    </AppText>
                    <AppText as="p" className="private-typography-sheet__hint">
                        {t('private_card_theme_color_hint', {
              defaultValue: 'One color for the frame and all text. Plain — no shadow on text.'
            })}
                    </AppText>
                    <PrivateCardThemeColorPanel valueHex={themeColorHex} onColorChange={onThemeColorChange} />
                    <button
            type="button"
            className="private-typography-sheet__text-color-reset private-typography-sheet__text-color-reset--block"
            onClick={() => onThemeColorChange?.(null)}>

                        {t('private_card_theme_color_reset', { defaultValue: 'Use default card colors' })}
                    </button>
                </section>
            </div>
        </div>,
    document.body
  );
}