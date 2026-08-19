import React, { useRef } from 'react';
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
  const optionRefs = useRef([]);

  const selectGradient = (preset, element) => {
    onSelectGradient?.(preset.color, preset.color2);
    if (element) scrollItemIntoView(element);
  };

  // Roving tabindex (WAI-ARIA listbox pattern): only the active option is
  // tab-stoppable; arrow keys move focus + selection between options.
  const optionCount = (showTransparent ? 1 : 0) + BANNER_BG_PRESETS.length;
  let activeIndex = showTransparent && transparentSelected
    ? 0
    : BANNER_BG_PRESETS.findIndex((preset) => !transparentSelected && colorsMatch(colorStart, colorEnd, preset)) +
      (showTransparent ? 1 : 0);
  if (activeIndex < 0) activeIndex = 0;

  const focusOption = (index) => {
    const el = optionRefs.current[index];
    if (el) el.focus();
  };

  const activateOption = (index) => {
    if (index === 0 && showTransparent) {
      onSelectTransparent?.();
      return;
    }
    const preset = BANNER_BG_PRESETS[index - (showTransparent ? 1 : 0)];
    if (preset) selectGradient(preset, optionRefs.current[index]);
  };

  const handleOptionKeyDown = (event, index) => {
    if (disabled) return;
    let nextIndex = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % optionCount;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + optionCount) % optionCount;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = optionCount - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusOption(nextIndex);
    activateOption(nextIndex);
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
          ref={(el) => { optionRefs.current[0] = el; }}
          type="button"
          role="option"
          aria-selected={transparentSelected}
          disabled={disabled}
          tabIndex={activeIndex === 0 ? 0 : -1}
          className={`community-banner-modal__gradient-card community-banner-modal__gradient-card--transparent${
            transparentSelected ? ' community-banner-modal__gradient-card--active' : ''
          }`}
          title={t(
            'community_banner_bg_transparent_hint',
            'Show text over the banner image'
          )}
          onKeyDown={(event) => handleOptionKeyDown(event, 0)}
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
      {BANNER_BG_PRESETS.map((preset, presetIndex) => {
        const index = presetIndex + (showTransparent ? 1 : 0);
        const active = !transparentSelected && colorsMatch(colorStart, colorEnd, preset);
        const label = t(`community_banner_gradient_${preset.id}`, preset.label || preset.id);

        return (
          <button
            key={preset.id}
            ref={(el) => { optionRefs.current[index] = el; }}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={label}
            disabled={disabled}
            tabIndex={activeIndex === index ? 0 : -1}
            className={`community-banner-modal__gradient-card${
              active ? ' community-banner-modal__gradient-card--active' : ''
            }`}
            style={{
              background: buildBannerGradientCss(preset.color, preset.color2),
            }}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
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
