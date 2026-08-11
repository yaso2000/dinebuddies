import React, { useState } from 'react';
import { FaBold, FaItalic } from 'react-icons/fa';
import { STUDIO_BACKDROP_SWATCHES, STUDIO_TEXT_SWATCHES } from './studioConstants';
import { AppText } from '../../../components/base';

/** @typedef {'title' | 'body' | 'backdrop'} StudioColorTarget */

/** Horizontal range slider for numeric studio values (font size, spacing, overlay, etc.). */
export function StudioStepperRow({ label, value, min, max, step = 1, onChange, suffix = '' }) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const handleChange = (e) => {
    const raw = Number(e.target.value);
    const next = step === 1 ? raw : Math.round(raw / step) * step;
    onChange(clamp(next));
  };

  return (
    <div className="sps-stepper-row sps-stepper-row--slider">
            <div className="sps-stepper-row__head">
                <AppText as="span" className="sps-stepper-row__label">{label}</AppText>
                <AppText as="span" className="sps-stepper-row__value">
                    {value}
                    {suffix}
                </AppText>
            </div>
            <input
        type="range"
        className="sps-range sps-stepper-row__range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value} />

        </div>);

}

function ColorDot({ color, active, onClick, className = '' }) {
  const isGradient = String(color).startsWith('linear-gradient');
  const style =
  isGradient || color && color !== 'transparent' ? { background: color } : undefined;
  return (
    <button
      type="button"
      className={`sps-swatch sps-swatch--premium${
      isGradient ? ' sps-swatch--gradient' : ''}${
      active ? ' active' : ''}${className}`}
      style={style}
      onClick={onClick}
      aria-label={isGradient ? 'gradient' : color} />);


}

const COLOR_TARGETS = [
{
  id: 'title',
  labelKey: 'studio_main_text_color',
  label: 'Title color',
  styleKey: 'textColor',
  fallback: '#ffffff',
  swatches: STUDIO_TEXT_SWATCHES
},
{
  id: 'body',
  labelKey: 'studio_sub_text_color',
  label: 'Text color',
  styleKey: 'subtitleColor',
  fallback: '#ff9d2e',
  swatches: STUDIO_TEXT_SWATCHES
},
{
  id: 'backdrop',
  labelKey: 'studio_backdrop_gradient',
  label: 'Gradient backdrop',
  styleKey: 'backgroundColor',
  fallback: 'transparent',
  swatches: STUDIO_BACKDROP_SWATCHES
}];


export function StudioColorsPanel({ style, setStyle, t }) {
  const [activeTarget, setActiveTarget] = useState('title');

  const target = COLOR_TARGETS.find((item) => item.id === activeTarget) || COLOR_TARGETS[0];
  const currentValue = style[target.styleKey] ?? target.fallback;

  const applyColor = (color) => {
    setStyle((s) => ({ ...s, [target.styleKey]: color }));
  };

  return (
    <div className="sps-glass-panel sps-glass-panel--colors sps-colors-panel">
            <div className="sps-color-targets" role="tablist">
                {COLOR_TARGETS.map((item) => {
          const value = style[item.styleKey] ?? item.fallback;
          const isActive = activeTarget === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`sps-color-target${isActive ? ' active' : ''}`}
              onClick={() => setActiveTarget(item.id)}>

                            <AppText as="span"
              className={`sps-color-target__dot${
              value === 'transparent' ? ' sps-color-target__dot--clear' : ''}`
              }
              style={value !== 'transparent' ? { background: value } : undefined}
              aria-hidden />

                            <AppText as="span" className="sps-color-target__label">
                                {t(item.labelKey, item.label)}
                            </AppText>
                        </button>);

        })}
            </div>

            <div
        className="sps-color-picker-panel"
        role="tabpanel"
        aria-label={t(target.labelKey, target.label)}>

                <div className="sps-swatch-scroll sps-swatch-scroll--picker">
                    {target.swatches.map((c) =>
          <ColorDot
            key={`${target.id}-${c}`}
            color={c}
            active={currentValue === c}
            onClick={() => applyColor(c)}
            className={c === 'transparent' ? ' sps-swatch--transparent' : ''} />

          )}
                </div>
            </div>

            {activeTarget === 'backdrop' &&
      <AppText as="p" className="sps-colors-panel__hint">
                    {t('studio_backdrop_hint')}
                </AppText>
      }
        </div>);

}

export function StudioTypographyPanel({ style, setStyle, fonts, applyFont, t }) {
  const activeFontId = style.fontId || fonts[0]?.id;

  return (
    <div className="sps-glass-panel sps-glass-panel--type sps-type-panel">
            <div className="sps-type-panel__format">
                <button
          type="button"
          className={`sps-mini-tool${style.fontWeight >= 700 ? ' active' : ''}`}
          onClick={() =>
          setStyle((s) => ({ ...s, fontWeight: s.fontWeight >= 700 ? 500 : 800 }))
          }
          aria-label={t('studio_bold')}>

                    <FaBold />
                </button>
                <button
          type="button"
          className={`sps-mini-tool${style.fontStyle === 'italic' ? ' active' : ''}`}
          onClick={() =>
          setStyle((s) => ({
            ...s,
            fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic'
          }))
          }
          aria-label={t('studio_italic')}>

                    <FaItalic />
                </button>
            </div>
            <div className="sps-font-grid" role="listbox" aria-label={t('studio_font_family')}>
                {fonts.map((font) =>
        <button
          key={font.id}
          type="button"
          role="option"
          aria-selected={activeFontId === font.id}
          className={`sps-font-grid__item${activeFontId === font.id ? ' active' : ''}`}
          style={{ fontFamily: font.family }}
          onClick={() => applyFont(font.id)}>

                        <AppText as="span" className="sps-font-grid__sample">{font.sample}</AppText>
                        <AppText as="span" className="sps-font-grid__name">{font.label}</AppText>
                    </button>
        )}
            </div>
        </div>);

}

