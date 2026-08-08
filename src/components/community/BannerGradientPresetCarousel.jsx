import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck } from 'react-icons/fa';
import { AppText } from '../base';
import { useDragScrollRail } from '../../hooks/useDragScrollRail';
import {
  BANNER_BG_PRESETS,
  buildBannerGradientCss,
  sanitizeBannerHexColor,
} from '../../utils/communityChatBanner';

function colorsMatch(start, end, preset) {
  return (
    sanitizeBannerHexColor(start).toLowerCase() === preset.color.toLowerCase() &&
    sanitizeBannerHexColor(end).toLowerCase() === preset.color2.toLowerCase()
  );
}

export default function BannerGradientPresetCarousel({
  colorStart,
  colorEnd,
  disabled = false,
  showTransparent = false,
  transparentSelected = false,
  onSelectTransparent,
  onSelectGradient,
  ariaLabel,
}) {
  const { t } = useTranslation();
  const {
    railRef,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    wasDragged,
    scrollItemIntoView,
  } = useDragScrollRail();

  const selectGradient = (preset, element) => {
    onSelectGradient?.(preset.color, preset.color2);
    if (element) scrollItemIntoView(element);
  };

  return (
    <div
      ref={railRef}
      className={`community-banner-modal__gradient-rail${isDragging ? ' is-dragging' : ''}`}
      role="listbox"
      aria-label={
        ariaLabel || t('community_banner_bg_gradient_presets', 'Gradient presets')
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    >
      {showTransparent ? (
        <button
          type="button"
          role="option"
          aria-selected={transparentSelected}
          disabled={disabled}
          className={`community-banner-modal__gradient-card community-banner-modal__gradient-card--transparent${
            transparentSelected ? ' community-banner-modal__gradient-card--active' : ''
          }`}
          title={t(
            'community_banner_bg_transparent_hint',
            'Show text over the banner image'
          )}
          onClick={(event) => {
            if (wasDragged()) return;
            onSelectTransparent?.();
            scrollItemIntoView(event.currentTarget);
          }}
        >
          <AppText as="span" className="community-banner-modal__gradient-card-label">
            {t('community_banner_bg_transparent', 'Transparent')}
          </AppText>
          {transparentSelected ? (
            <FaCheck className="community-banner-modal__gradient-card-check" aria-hidden />
          ) : null}
        </button>
      ) : null}
      {BANNER_BG_PRESETS.map((preset) => {
        const active = !transparentSelected && colorsMatch(colorStart, colorEnd, preset);
        const label = t(`community_banner_gradient_${preset.id}`, preset.label || preset.id);

        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={label}
            disabled={disabled}
            className={`community-banner-modal__gradient-card${
              active ? ' community-banner-modal__gradient-card--active' : ''
            }`}
            style={{
              background: buildBannerGradientCss(preset.color, preset.color2),
            }}
            onClick={(event) => {
              if (wasDragged()) return;
              selectGradient(preset, event.currentTarget);
            }}
          >
            <AppText as="span" className="community-banner-modal__gradient-card-label">
              {label}
            </AppText>
            {active ? (
              <FaCheck className="community-banner-modal__gradient-card-check" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
