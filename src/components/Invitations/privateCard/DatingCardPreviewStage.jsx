import React from 'react';
import { useTranslation } from 'react-i18next';
import PrivateCardTextBackdropTonePicker from './PrivateCardTextBackdropTonePicker';
import { PRIVATE_TEXT_BACKDROP_ICON_ORDER } from './privateCardTextBackdrop';
import PrivateCardCopyLayoutRail from './PrivateCardCopyLayoutRail';
import PrivateCardCopyFontScaleRail from './PrivateCardCopyFontScaleRail';
import DatingCardTypographyBars from './DatingCardTypographyBars';
import './DatingCardPreviewStage.css';


/**
 * Preview chrome: show/hide button, backdrop icons, copy layout rail on card; typography below.
 */
export default function DatingCardPreviewStage({
    showHostAndMessage,
    onShowHostAndMessageChange,
    editorPhotoBackgroundActive,
    textBackdropTone,
    onTextBackdropToneChange,
    copyOffsetY,
    copyWidthPct,
    copyFontScale,
    onCopyOffsetYChange,
    onCopyWidthPctChange,
    onCopyFontScaleChange,
    fontId,
    themeColorHex,
    onFontChange,
    onThemeColorChange,
    children
}) {
    const { t } = useTranslation();

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
                            toneOrder={PRIVATE_TEXT_BACKDROP_ICON_ORDER}
                            tone={textBackdropTone}
                            onToneChange={onTextBackdropToneChange}
                        />
                    ) : null}
                </div>

                {children}

                {showHostAndMessage ? (
                    <>
                        <div className="dating-card-preview-stage__side-rail dating-card-preview-stage__side-rail--font">
                            <PrivateCardCopyFontScaleRail
                                copyFontScale={copyFontScale}
                                onCopyFontScaleChange={onCopyFontScaleChange}
                            />
                        </div>
                        <div className="dating-card-preview-stage__side-rail">
                            <PrivateCardCopyLayoutRail
                                copyOffsetY={copyOffsetY}
                                copyWidthPct={copyWidthPct}
                                onCopyOffsetYChange={onCopyOffsetYChange}
                                onCopyWidthPctChange={onCopyWidthPctChange}
                            />
                        </div>
                    </>
                ) : null}
            </div>

            <DatingCardTypographyBars
                variant="below"
                hideToggle
                alwaysVisible
                fontId={fontId}
                themeColorHex={themeColorHex}
                onFontChange={onFontChange}
                onThemeColorChange={onThemeColorChange}
            />
        </div>
    );
}
