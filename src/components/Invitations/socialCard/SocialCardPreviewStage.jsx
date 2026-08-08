import React from 'react';
import { useTranslation } from 'react-i18next';
import SocialCardTextBackdropTonePicker from './SocialCardTextBackdropTonePicker';
import { SOCIAL_TEXT_BACKDROP_ICON_ORDER } from './socialCardTextBackdrop';
import SocialCardCopyLayoutRail from './SocialCardCopyLayoutRail';
import SocialCardCopyFontScaleRail from './SocialCardCopyFontScaleRail';
import PrivateCardTypographyBars from '../privateCard/PrivateCardTypographyBars';
import './SocialCardPreviewStage.css';

/**
 * Social invite preview chrome: show/hide button, backdrop icons, copy layout rail on card.
 */
export default function SocialCardPreviewStage({
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
    children,
}) {
    const { t } = useTranslation();

    return (
        <div className="social-card-preview-bundle">
            <div className="social-card-preview-stage">
                <div className="social-card-preview-stage__top">
                    <button
                        type="button"
                        className="social-card-preview-stage__text-btn"
                        title={t('social_card_show_content_title', {
                            defaultValue:
                                'Off: date and place only on the card. On: show title, message, and profile photo.',
                        })}
                        aria-pressed={showHostAndMessage}
                        onClick={() => onShowHostAndMessageChange?.(!showHostAndMessage)}
                    >
                        {showHostAndMessage
                            ? t('social_card_hide_text', { defaultValue: 'Hide text' })
                            : t('social_card_show_text', { defaultValue: 'Show text' })}
                    </button>

                    {showHostAndMessage && editorPhotoBackgroundActive ? (
                        <SocialCardTextBackdropTonePicker
                            variant="icons"
                            toneOrder={SOCIAL_TEXT_BACKDROP_ICON_ORDER}
                            tone={textBackdropTone}
                            onToneChange={onTextBackdropToneChange}
                        />
                    ) : null}
                </div>

                {children}

                {showHostAndMessage ? (
                    <>
                        <div className="social-card-preview-stage__side-rail social-card-preview-stage__side-rail--font">
                            <SocialCardCopyFontScaleRail
                                copyFontScale={copyFontScale}
                                onCopyFontScaleChange={onCopyFontScaleChange}
                            />
                        </div>
                        <div className="social-card-preview-stage__side-rail">
                            <SocialCardCopyLayoutRail
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
