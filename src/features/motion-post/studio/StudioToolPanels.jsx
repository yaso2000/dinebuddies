import React, { useState } from 'react';
import {
    FaAlignCenter,
    FaAlignLeft,
    FaAlignRight,
    FaArrowDown,
    FaArrowUp,
    FaBold,
    FaBullhorn,
    FaDollarSign,
    FaFire,
    FaGift,
    FaItalic,
    FaLayerGroup,
    FaMedal,
    FaPercent,
    FaShoppingBag,
    FaSquare,
    FaStar,
    FaSun,
    FaTag,
} from 'react-icons/fa';
import {
    STUDIO_BACKDROP_SWATCHES,
    STUDIO_FX_COLOR_SWATCHES,
    STUDIO_FX_DEFAULTS,
    STUDIO_NEON_PRIMARY,
    STUDIO_OVERLAY_TINTS,
    STUDIO_PROMO_MAX,
    STUDIO_PROMO_STICKERS,
    STUDIO_TEXT_SWATCHES,
    STUDIO_TEXT_VERTICAL_ALIGNS,
    studioPromoStickerLabel,
} from './studioConstants';

/** Icon-only promo picker (canvas stickers still use display labels). */
const STUDIO_PROMO_ICON_MAP = {
    pct_70: FaPercent,
    pct_50: FaPercent,
    pct_30: FaPercent,
    pct_25: FaPercent,
    off: FaTag,
    sale: FaShoppingBag,
    new: FaMedal,
    hot: FaFire,
    gift: FaGift,
    tag_ar: FaBullhorn,
    free: FaDollarSign,
    star: FaStar,
};

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
                <span className="sps-stepper-row__label">{label}</span>
                <span className="sps-stepper-row__value">
                    {value}
                    {suffix}
                </span>
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
                aria-valuenow={value}
            />
        </div>
    );
}

function ColorDot({ color, active, onClick, className = '' }) {
    const isGradient = String(color).startsWith('linear-gradient');
    const style =
        isGradient || (color && color !== 'transparent') ? { background: color } : undefined;
    return (
        <button
            type="button"
            className={`sps-swatch sps-swatch--premium${
                isGradient ? ' sps-swatch--gradient' : ''
            }${active ? ' active' : ''}${className}`}
            style={style}
            onClick={onClick}
            aria-label={isGradient ? 'gradient' : color}
        />
    );
}

function ColorRow({ label, colors, value, onChange }) {
    return (
        <div className="sps-color-row">
            <span className="sps-color-row__label">{label}</span>
            <div className="sps-swatch-scroll">
                {colors.map((c) => (
                    <ColorDot
                        key={`${label}-${c}`}
                        color={c}
                        active={value === c}
                        onClick={() => onChange(c)}
                        className={c === 'transparent' ? ' sps-swatch--transparent' : ''}
                    />
                ))}
            </div>
        </div>
    );
}

const COLOR_TARGETS = [
    {
        id: 'title',
        labelKey: 'studio_main_text_color',
        label: 'Title color',
        styleKey: 'textColor',
        fallback: '#ffffff',
        swatches: STUDIO_TEXT_SWATCHES,
    },
    {
        id: 'body',
        labelKey: 'studio_sub_text_color',
        label: 'Text color',
        styleKey: 'subtitleColor',
        fallback: '#ff9d2e',
        swatches: STUDIO_TEXT_SWATCHES,
    },
    {
        id: 'backdrop',
        labelKey: 'studio_backdrop_gradient',
        label: 'Gradient backdrop',
        styleKey: 'backgroundColor',
        fallback: 'transparent',
        swatches: STUDIO_BACKDROP_SWATCHES,
    },
];

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
                            onClick={() => setActiveTarget(item.id)}
                        >
                            <span
                                className={`sps-color-target__dot${
                                    value === 'transparent' ? ' sps-color-target__dot--clear' : ''
                                }`}
                                style={value !== 'transparent' ? { background: value } : undefined}
                                aria-hidden
                            />
                            <span className="sps-color-target__label">
                                {t(item.labelKey, item.label)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div
                className="sps-color-picker-panel"
                role="tabpanel"
                aria-label={t(target.labelKey, target.label)}
            >
                <div className="sps-swatch-scroll sps-swatch-scroll--picker">
                    {target.swatches.map((c) => (
                        <ColorDot
                            key={`${target.id}-${c}`}
                            color={c}
                            active={currentValue === c}
                            onClick={() => applyColor(c)}
                            className={c === 'transparent' ? ' sps-swatch--transparent' : ''}
                        />
                    ))}
                </div>
            </div>

            {activeTarget === 'backdrop' && (
                <p className="sps-colors-panel__hint">
                    {t('studio_backdrop_hint')}
                </p>
            )}
        </div>
    );
}

export function StudioTransparencyPanel({ style, setStyle, t }) {
    const tint = style.overlayTintColor ?? '#000000';
    const density = style.overlayOpacity ?? 35;

    return (
        <div className="sps-glass-panel sps-glass-panel--compact sps-transparency-panel">
            <ColorRow
                label={t('studio_overlay_tint')}
                colors={STUDIO_OVERLAY_TINTS}
                value={tint}
                onChange={(c) => setStyle((s) => ({ ...s, overlayTintColor: c }))}
            />
            <StudioStepperRow
                label={t('studio_overlay_density')}
                value={density}
                min={0}
                max={100}
                step={1}
                onChange={(v) => setStyle((s) => ({ ...s, overlayOpacity: v }))}
                suffix="%"
            />
            <p className="sps-colors-panel__hint">
                {t('studio_overlay_hint')}
            </p>
        </div>
    );
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
                    aria-label={t('studio_bold')}
                >
                    <FaBold />
                </button>
                <button
                    type="button"
                    className={`sps-mini-tool${style.fontStyle === 'italic' ? ' active' : ''}`}
                    onClick={() =>
                        setStyle((s) => ({
                            ...s,
                            fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic',
                        }))
                    }
                    aria-label={t('studio_italic')}
                >
                    <FaItalic />
                </button>
            </div>
            <div className="sps-font-grid" role="listbox" aria-label={t('studio_font_family')}>
                {fonts.map((font) => (
                    <button
                        key={font.id}
                        type="button"
                        role="option"
                        aria-selected={activeFontId === font.id}
                        className={`sps-font-grid__item${activeFontId === font.id ? ' active' : ''}`}
                        style={{ fontFamily: font.family }}
                        onClick={() => applyFont(font.id)}
                    >
                        <span className="sps-font-grid__sample">{font.sample}</span>
                        <span className="sps-font-grid__name">{font.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function StudioAlignPanel({ style, setStyle, t }) {
    const stackGap = style.textStackGap ?? 6;
    const padTop = style.textPaddingTop ?? 0;
    const padBottom = style.textPaddingBottom ?? 0;

    return (
        <div className="sps-glass-panel sps-glass-panel--compact sps-align-panel">
            <div className="sps-align-panel__body">
                <div className="sps-align-panel__row">
                    <div className="sps-align-panel__col">
                        <p className="sps-glass-sub">{t('studio_align_h')}</p>
                        <div className="sps-glass-tools">
                            {[
                                { id: 'left', Icon: FaAlignLeft },
                                { id: 'center', Icon: FaAlignCenter },
                                { id: 'right', Icon: FaAlignRight },
                            ].map(({ id, Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`sps-mini-tool${style.textAlign === id ? ' active' : ''}`}
                                    onClick={() => setStyle((s) => ({ ...s, textAlign: id }))}
                                >
                                    <Icon />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sps-align-panel__col">
                        <p className="sps-glass-sub">{t('studio_align_v')}</p>
                        <div className="sps-glass-tools">
                            {STUDIO_TEXT_VERTICAL_ALIGNS.map((v) => {
                                const Icon =
                                    v.id === 'top'
                                        ? FaArrowUp
                                        : v.id === 'bottom'
                                          ? FaArrowDown
                                          : FaAlignCenter;
                                return (
                                    <button
                                        key={v.id}
                                        type="button"
                                        className={`sps-mini-tool${
                                            (style.textVerticalAlign || 'center') === v.id
                                                ? ' active'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setStyle((s) => ({ ...s, textVerticalAlign: v.id }))
                                        }
                                        title={t(v.labelKey, v.label)}
                                        aria-label={t(v.labelKey, v.label)}
                                    >
                                        <Icon />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="sps-align-panel__spacing">
                    <p className="sps-glass-sub">{t('studio_text_spacing')}</p>
                    <StudioStepperRow
                        label={t('studio_text_gap')}
                        value={stackGap}
                        min={0}
                        max={40}
                        step={2}
                        onChange={(v) => setStyle((s) => ({ ...s, textStackGap: v }))}
                        suffix="px"
                    />
                    <StudioStepperRow
                        label={t('studio_text_margin_top')}
                        value={padTop}
                        min={0}
                        max={72}
                        step={2}
                        onChange={(v) => setStyle((s) => ({ ...s, textPaddingTop: v }))}
                        suffix="px"
                    />
                    <StudioStepperRow
                        label={t('studio_text_margin_bottom')}
                        value={padBottom}
                        min={0}
                        max={72}
                        step={2}
                        onChange={(v) => setStyle((s) => ({ ...s, textPaddingBottom: v }))}
                        suffix="px"
                    />
                </div>
            </div>
        </div>
    );
}

/** @param {{ pickerId: string; icon: import('react').ComponentType<{ size?: number }>; label: string; active: boolean; isColorTarget: boolean; onSelectTarget: (id: string) => void; onToggle: (on: boolean) => void }} props */
function FxEffectCell({
    pickerId,
    icon: Icon,
    label,
    active,
    isColorTarget,
    onSelectTarget,
    onToggle,
}) {
    return (
        <div
            className={`sps-fx-cell${active ? ' is-on' : ''}${isColorTarget ? ' is-target' : ''}`}
        >
            <button
                type="button"
                className="sps-fx-toggle"
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => {
                    if (isColorTarget && active) {
                        onToggle(false);
                        return;
                    }
                    onSelectTarget(pickerId);
                    if (!active) onToggle(true);
                }}
            >
                <Icon size={18} aria-hidden />
                <span className="sps-fx-toggle__label">{label}</span>
            </button>
        </div>
    );
}

export function StudioEffectsPanel({ style, setStyle, t }) {
    const [fxColorTarget, setFxColorTarget] = useState('shadow');
    const shadowOn = style.textShadow !== false;
    const glowOn = Number(style.glowIntensity ?? 0) > 0;
    const strokeOn = Boolean(style.textStroke);

    const activeFxColor =
        fxColorTarget === 'stroke'
            ? style.strokeColor || STUDIO_FX_DEFAULTS.strokeColor
            : fxColorTarget === 'glow'
              ? style.glowColor || STUDIO_FX_DEFAULTS.glowColor
              : style.shadowColor || STUDIO_FX_DEFAULTS.shadowColor;

    const applyFxColor = (c) => {
        if (fxColorTarget === 'shadow') {
            setStyle((s) => ({
                ...s,
                titleColorMode: 'solid',
                bodyColorMode: 'solid',
                textShadow: true,
                shadowColor: c,
                shadowDepth: s.shadowDepth ?? STUDIO_FX_DEFAULTS.shadowDepth,
                shadowBlur: s.shadowBlur ?? STUDIO_FX_DEFAULTS.shadowBlur,
                shadowOffsetX: s.shadowOffsetX ?? STUDIO_FX_DEFAULTS.shadowOffsetX,
                shadowOffsetY: s.shadowOffsetY ?? STUDIO_FX_DEFAULTS.shadowOffsetY,
            }));
            return;
        }
        if (fxColorTarget === 'stroke') {
            setStyle((s) => ({
                ...s,
                titleColorMode: 'solid',
                bodyColorMode: 'solid',
                textStroke: true,
                strokeColor: c,
                strokeWidth: STUDIO_FX_DEFAULTS.strokeWidth,
            }));
            return;
        }
        setStyle((s) => ({
            ...s,
            titleColorMode: 'solid',
            bodyColorMode: 'solid',
            glowColor: c,
            glowIntensity: STUDIO_FX_DEFAULTS.glowIntensity,
        }));
    };

    return (
        <div className="sps-glass-panel sps-glass-panel--compact sps-effects-panel">
            <p className="sps-glass-sub">
                {t('studio_fx_pick')}
            </p>
            <div className="sps-fx-toolbar">
                <FxEffectCell
                    pickerId="shadow"
                    icon={FaLayerGroup}
                    label={t('studio_text_shadow')}
                    active={shadowOn}
                    isColorTarget={fxColorTarget === 'shadow'}
                    onSelectTarget={setFxColorTarget}
                    onToggle={(on) =>
                        setStyle((s) => ({
                            ...s,
                            titleColorMode: 'solid',
                            bodyColorMode: 'solid',
                            textShadow: on,
                            ...(on
                                ? {
                                      shadowDepth: STUDIO_FX_DEFAULTS.shadowDepth,
                                      shadowBlur: STUDIO_FX_DEFAULTS.shadowBlur,
                                      shadowOffsetX: STUDIO_FX_DEFAULTS.shadowOffsetX,
                                      shadowOffsetY: STUDIO_FX_DEFAULTS.shadowOffsetY,
                                      shadowColor:
                                          s.shadowColor || STUDIO_FX_DEFAULTS.shadowColor,
                                  }
                                : {}),
                        }))
                    }
                />
                <FxEffectCell
                    pickerId="stroke"
                    icon={FaSquare}
                    label={t('studio_text_stroke')}
                    active={strokeOn}
                    isColorTarget={fxColorTarget === 'stroke'}
                    onSelectTarget={setFxColorTarget}
                    onToggle={(on) =>
                        setStyle((s) => ({
                            ...s,
                            titleColorMode: 'solid',
                            bodyColorMode: 'solid',
                            textStroke: on,
                            ...(on
                                ? {
                                      strokeWidth: STUDIO_FX_DEFAULTS.strokeWidth,
                                      strokeColor:
                                          s.strokeColor || STUDIO_FX_DEFAULTS.strokeColor,
                                  }
                                : {}),
                        }))
                    }
                />
                <FxEffectCell
                    pickerId="glow"
                    icon={FaSun}
                    label={t('studio_glow')}
                    active={glowOn}
                    isColorTarget={fxColorTarget === 'glow'}
                    onSelectTarget={setFxColorTarget}
                    onToggle={(on) =>
                        setStyle((s) => ({
                            ...s,
                            titleColorMode: 'solid',
                            bodyColorMode: 'solid',
                            glowIntensity: on ? STUDIO_FX_DEFAULTS.glowIntensity : 0,
                            ...(on && !s.glowColor ? { glowColor: STUDIO_FX_DEFAULTS.glowColor } : {}),
                        }))
                    }
                />
            </div>
            <div
                className="sps-fx-color-scroll sps-swatch-scroll sps-swatch-scroll--picker"
                role="listbox"
                aria-label={t('studio_fx_color_scroll', 'Effect colors')}
            >
                {STUDIO_FX_COLOR_SWATCHES.map((c) => (
                    <ColorDot
                        key={`fx-${c}`}
                        color={c}
                        active={activeFxColor === c}
                        onClick={() => applyFxColor(c)}
                    />
                ))}
            </div>
        </div>
    );
}

export function StudioPromoPanel({ onInsertSticker, stickerCount = 0, t }) {
    const maxStickers = STUDIO_PROMO_MAX;

    return (
        <div className="sps-glass-panel sps-glass-panel--promo sps-promo-panel">
            <p className="sps-glass-sub">{t('studio_promo_pick')}</p>
            <div className="sps-promo-panel__track" role="list">
                {STUDIO_PROMO_STICKERS.map((item) => {
                    const Icon = STUDIO_PROMO_ICON_MAP[item.id] || FaTag;
                    const tip = studioPromoStickerLabel(item, t);
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="listitem"
                            className={`sps-promo-chip sps-promo-chip--icon sps-promo-chip--${item.variant}`}
                            style={{
                                background: item.bg || undefined,
                                color: item.color || undefined,
                            }}
                            disabled={stickerCount >= maxStickers}
                            onClick={() => onInsertSticker(item.id)}
                            title={tip}
                            aria-label={tip}
                        >
                            <Icon size={18} aria-hidden />
                        </button>
                    );
                })}
            </div>
            <p className="sps-colors-panel__hint">
                {stickerCount >= maxStickers
                    ? t('studio_promo_max')
                    : t('studio_promo_hint')}
            </p>
        </div>
    );
}

export function StudioLayersPanel({ activeField, onSelectLayer, t }) {
    const layers = [
        { id: 'title', label: t('studio_layer_title') },
        { id: 'body', label: t('studio_layer_body') },
    ];
    return (
        <div className="sps-glass-panel sps-glass-panel--compact">
            {layers.map((layer) => (
                <button
                    key={layer.id}
                    type="button"
                    className={`sps-layer-row${activeField === layer.id ? ' active' : ''}`}
                    onClick={() => onSelectLayer(layer.id)}
                >
                    <span className="sps-layer-row__icon" aria-hidden />
                    {layer.label}
                </button>
            ))}
        </div>
    );
}
