import React from 'react';
import { useTranslation } from 'react-i18next';
import PrivateCardTextBackdropTonePicker from '../socialCard/SocialCardTextBackdropTonePicker';
import { PRIVATE_TEXT_BACKDROP_ICON_ORDER } from '../socialCard/socialCardTextBackdrop';
import PrivateCardCopyLayoutRail from '../socialCard/SocialCardCopyLayoutRail';
import PrivateCardCopyFontScaleRail from '../socialCard/SocialCardCopyFontScaleRail';
import PrivateCardTypographyBars from './PrivateCardTypographyBars';
import './PrivateCardPreviewStage.css';


/**
 * Preview chrome: show/hide button, backdrop icons, copy layout rail on card; typography below.
 */
export default function PrivateCardPreviewStage({
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
        <div className="private-card-preview-bundle">
            <div className="private-card-preview-stage">
                <div className="private-card-preview-stage__top">
                    <button
                        type="button"
                        className="private-card-preview-stage__text-btn"
                        title={t('private_card_show_content_title', {
                            defaultValue:
                                'Off: date and place only on the card. On: show title, message, and profile photo.'
                        })}
                        aria-pressed={showHostAndMessage}
                        onClick={() => onShowHostAndMessageChange?.(!showHostAndMessage)}
                    >
                        {showHostAndMessage
                            ? t('private_card_hide_text', { defaultValue: 'Hide text' })
                            : t('private_card_show_text', { defaultValue: 'Show text' })}
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
                        <div className="private-card-preview-stage__side-rail private-card-preview-stage__side-rail--font">
                            <PrivateCardCopyFontScaleRail
                                copyFontScale={copyFontScale}
                                onCopyFontScaleChange={onCopyFontScaleChange}
                            />
                        </div>
                        <div className="private-card-preview-stage__side-rail">
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

            <PrivateCardTypographyBars
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
