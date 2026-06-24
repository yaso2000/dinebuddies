import React, { useEffect, useRef, useState } from 'react';
import {
  containsArabicScript,
  rainbowColorAt,
  splitRainbowSegments,
  studioBuildTextShadow,
  studioLayerColorMode,
  studioRainbowPresetId } from
'./studioTextEffects';
import { AppText } from "../../../components/base";

function renderRainbowSpans(text, preset) {
  const segments = splitRainbowSegments(text);
  if (!segments.length) return null;
  const byWord = containsArabicScript(text);
  let colorIndex = 0;

  return segments.map((seg, i) => {
    if (seg.isSpace) {
      return (
        <AppText as="span" key={`sp-${i}`} className="sps-rainbow-space" aria-hidden>
                    {seg.segment}
                </AppText>);

    }
    const color = rainbowColorAt(colorIndex, preset);
    colorIndex += 1;
    return (
      <AppText as="span"
      key={`${i}-${seg.segment}`}
      className={byWord ? 'sps-rainbow-word' : 'sps-rainbow-char'}
      style={{ color }}>

                {seg.segment}
            </AppText>);

  });
}

/**
 * Title/body block with solid or per-letter rainbow colors + shared shadow/stroke.
 */
export default function StudioTextBlock({
  tag: Tag,
  className,
  value,
  placeholder,
  layer = 'title',
  style = {},
  studioStyle = {},
  maxLength,
  onChange,
  onFocus,
  onBlurField,
  isActive,
  scrollContainerRef,
  typingMode = false,
  readOnly = false,
  animStyle = {}
}) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const colorMode = studioLayerColorMode(studioStyle, layer);
  const rainbowPreset = studioRainbowPresetId(studioStyle);
  const isRainbow = colorMode === 'rainbow';
  const solidColor =
  layer === 'title' ?
  studioStyle.textColor || '#ffffff' :
  studioStyle.subtitleColor || studioStyle.textColor || '#ff9d2e';

  const accent = isRainbow ? rainbowColorAt(0, rainbowPreset) : solidColor;
  const glowAccent =
  Number(studioStyle.glowIntensity ?? 0) > 0 ?
  studioStyle.glowColor || accent :
  accent;
  const fxStyle = {
    textShadow: studioBuildTextShadow(studioStyle, glowAccent)
  };

  const baseStyle = {
    ...style,
    ...fxStyle,
    ...animStyle,
    color: isRainbow && (readOnly || !focused) ? undefined : solidColor
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || readOnly || !isRainbow) return;
    if (document.activeElement === el) return;
    el.textContent = value || '';
  }, [value, readOnly, isRainbow]);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) {
      el.textContent = value || '';
    }
  }, [value]);

  const handleFocus = () => {
    setFocused(true);
    if (isRainbow && ref.current) {
      ref.current.textContent = value || '';
    }
    onFocus?.();
    if (typingMode || readOnly) return;
    requestAnimationFrame(() => {
      const el = ref.current;
      const container = scrollContainerRef?.current;
      if (!el) return;
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        el.scrollIntoView(true);
      }
      if (container && typeof container.scrollTop === 'number') {
        const rect = el.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        if (rect.bottom > cRect.bottom - 80 || rect.top < cRect.top + 40) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    });
  };

  if (readOnly) {
    if (!value?.trim()) {
      if (!placeholder) return null;
      return (
        <Tag className={`${className} is-empty`} style={{ ...baseStyle, opacity: 0.42 }}>
                    {placeholder}
                </Tag>);

    }
    if (!isRainbow) {
      return (
        <Tag className={className} style={baseStyle}>
                    {value}
                </Tag>);

    }
    return (
      <Tag className={className} style={baseStyle}>
                {renderRainbowSpans(value, rainbowPreset)}
            </Tag>);

  }

  if (isRainbow && !focused) {
    return (
      <Tag
        ref={ref}
        className={`${className}${isActive ? ' is-focused' : ''}${!value.trim() ? ' is-empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={placeholder}
        data-placeholder={placeholder}
        style={baseStyle}
        inputMode="text"
        enterKeyHint="done"
        onFocus={handleFocus}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onInput={(e) => {
          const text = e.currentTarget.textContent || '';
          if (maxLength && text.length > maxLength) {
            e.currentTarget.textContent = text.slice(0, maxLength);
            onChange(text.slice(0, maxLength));
            return;
          }
          onChange(text);
        }}
        onBlur={(e) => {
          setFocused(false);
          onChange((e.currentTarget.textContent || '').trimEnd());
          onBlurField?.();
        }}>

                {renderRainbowSpans(value, rainbowPreset)}
            </Tag>);

  }

  return (
    <Tag
      ref={ref}
      className={`${className}${isActive ? ' is-focused' : ''}${!value.trim() ? ' is-empty' : ''}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      data-placeholder={placeholder}
      style={baseStyle}
      inputMode="text"
      enterKeyHint="done"
      onFocus={handleFocus}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onInput={(e) => {
        const text = e.currentTarget.textContent || '';
        if (maxLength && text.length > maxLength) {
          e.currentTarget.textContent = text.slice(0, maxLength);
          onChange(text.slice(0, maxLength));
          return;
        }
        onChange(text);
      }}
      onBlur={(e) => {
        setFocused(false);
        onChange((e.currentTarget.textContent || '').trimEnd());
        onBlurField?.();
      }} />);


}