import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFont } from 'react-icons/fa';
import PrivateCardTextBackdropTonePicker from './PrivateCardTextBackdropTonePicker';
import PrivateCardMotionPicker from './PrivateCardMotionPicker';
import DatingCardTypographyBars from './DatingCardTypographyBars';
import './DatingCardPreviewStage.css';

/** Icon order for dating preview: white panel, dark panel, none. */
const BACKDROP_ICON_ORDER = ['light', 'dark', 'none'];

/**
 * Preview chrome: show/hide button, backdrop icons, motion rail on card; typography below.
 */
export default function DatingCardPreviewStage({
    showHostAndMessage,
    onShowHostAndMessageChange,
    editorPhotoBackgroundActive,
    textBackdropTone,
    onTextBackdropToneChange,
    cardMotionId,
    onCardMotionChange,
    fontId,
    themeColorHex,
    onFontChange,
    onThemeColorChange,
    children
}) {
    const { t } = useTranslation();
    const [typographyOpen, setTypographyOpen] = useState(false);

    return (
        <div className="dating-card-preview-bundle">
            <div className="dating-card-preview-stage">
                <div className="dating-card-preview-stage__top">
                    <button
                        type="button"
                        className="dating-card-preview-stage__text-btn"
                        title={t('dating_card_show_content_title', {
                            defaultValue:
                                'Off: date and place only on the card. On: show title, message, and profile photo.'
                        })}
                        aria-pressed={showHostAndMessage}
                        onClick={() => onShowHostAndMessageChange?.(!showHostAndMessage)}
                    >
                        {showHostAndMessage
                            ? t('dating_card_hide_text', { defaultValue: 'Hide text' })
                            : t('dating_card_show_text', { defaultValue: 'Show text' })}
                    </button>

                    {showHostAndMessage && editorPhotoBackgroundActive ? (
                        <PrivateCardTextBackdropTonePicker
                            variant="icons"
                            toneOrder={BACKDROP_ICON_ORDER}
                            tone={textBackdropTone}
                            onToneChange={onTextBackdropToneChange}
                        />
                    ) : null}
                </div>

                {children}

                <div className="dating-card-preview-stage__side-rail">
                    <PrivateCardMotionPicker variant="rail" value={cardMotionId} onChange={onCardMotionChange} />
                    <button
                        type="button"
                        className={`dating-card-preview-stage__font-toggle${
                            typographyOpen ? ' dating-card-preview-stage__font-toggle--open' : ''
                        }`}
                        onClick={() => setTypographyOpen((v) => !v)}
                        aria-expanded={typographyOpen}
                        aria-label={t('dating_card_style_btn', { defaultValue: 'Font & card color' })}
                        title={t('dating_card_style_btn', { defaultValue: 'Font & card color' })}
                    >
                        <FaFont aria-hidden />
                    </button>
                </div>
            </div>

            <DatingCardTypographyBars
                variant="below"
                open={typographyOpen}
                onOpenChange={setTypographyOpen}
                hideToggle
                fontId={fontId}
                themeColorHex={themeColorHex}
                onFontChange={onFontChange}
                onThemeColorChange={onThemeColorChange}
            />
        </div>
    );
}
