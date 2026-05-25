import React, { useState } from 'react';
import StudioFxColorPicker from './StudioFxColorPicker';
import {
    FaAlignCenter,
    FaAlignLeft,
    FaAlignRight,
    FaArrowDown,
    FaArrowUp,
    FaBold,
    FaItalic,
    FaLayerGroup,
    FaSquare,
    FaSun,
} from 'react-icons/fa';
import {
    STUDIO_BACKDROP_SWATCHES,
    STUDIO_FX_DEFAULTS,
    STUDIO_NEON_PRIMARY,
    STUDIO_OVERLAY_TINTS,
    STUDIO_PROMO_MAX,
    STUDIO_PROMO_STICKERS,
    STUDIO_TEXT_SWATCHES,
    STUDIO_TEXT_VERTICAL_ALIGNS,
} from './studioConstants';

/** @typedef {'title' | 'body' | 'backdrop'} StudioColorTarget */

/** Numeric control with − / + (replaces range sliders that render as blobs on some mobile browsers). */
export function StudioStepperRow({ label, value, min, max, step = 1, onChange, suffix = '' }) {
    const clamp = (n) => Math.min(max, Math.max(min, n));
    const dec = () => onChange(clamp(Number(value) - step));
    const inc = () => onChange(clamp(Number(value) + step));

    return (
        <div className="sps-stepper-row">
            <span className="sps-stepper-row__label">{label}</span>
            <div className="sps-stepper-row__controls">
                <button
                    type="button"
                    className="sps-stepper-btn"
                    onClick={dec}
                    disabled={value <= min}
                    aria-label={`${label} −`}
                >
                    −
                </button>
                <span className="sps-stepper-row__value">
                    {value}
                    {suffix}
                </span>
                <button
                    type="button"
                    className="sps-stepper-btn"
                    onClick={inc}
                    disabled={value >= max}
                    aria-label={`${label} +`}
                >
                    +
                </button>
            </div>
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
        label: 'لون العنوان',
        styleKey: 'textColor',
        fallback: '#ffffff',
        swatches: STUDIO_TEXT_SWATCHES,
    },
    {
        id: 'body',
        labelKey: 'studio_sub_text_color',
        label: 'لون النص',
        styleKey: 'subtitleColor',
        fallback: '#ff9d2e',
        swatches: STUDIO_TEXT_SWATCHES,
    },
    {
        id: 'backdrop',
        labelKey: 'studio_backdrop_gradient',
        label: 'خلفية متدرجة',
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
                    {t(
                        'studio_backdrop_hint',
                        'اختر تدرجاً للخلفية — بدون صورة يملأ التصميم. مع صورة: يظهر خلف الصورة وشريط النص في Header.'
                    )}
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
                label={t('studio_overlay_tint', 'لون الطبقة')}
                colors={STUDIO_OVERLAY_TINTS}
                value={tint}
                onChange={(c) => setStyle((s) => ({ ...s, overlayTintColor: c }))}
            />
            <StudioStepperRow
                label={t('studio_overlay_density', 'الكثافة')}
                value={density}
                min={0}
                max={100}
                step={1}
                onChange={(v) => setStyle((s) => ({ ...s, overlayOpacity: v }))}
                suffix="%"
            />
            <p className="sps-colors-panel__hint">
                {t(
                    'studio_overlay_hint',
                    'طبقة فوق الصورة/الغلاف — اختر لوناً ثم اضبط الكثافة بـ − و + (0–100%).'
                )}
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
                    aria-label={t('studio_bold', 'عريض')}
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
                    aria-label={t('studio_italic', 'مائل')}
                >
                    <FaItalic />
                </button>
            </div>
            <div className="sps-font-grid" role="listbox" aria-label={t('studio_font_family', 'الخط')}>
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
                        <p className="sps-glass-sub">{t('studio_align_h', 'أفقي')}</p>
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
                        <p className="sps-glass-sub">{t('studio_align_v', 'عمودي')}</p>
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
                    <p className="sps-glass-sub">{t('studio_text_spacing', 'المسافات')}</p>
                    <StudioStepperRow
                        label={t('studio_text_gap', 'بين العنوان والنص')}
                        value={stackGap}
                        min={0}
                        max={40}
                        step={2}
                        onChange={(v) => setStyle((s) => ({ ...s, textStackGap: v }))}
                        suffix="px"
                    />
                    <StudioStepperRow
                        label={t('studio_text_margin_top', 'هامش علوي')}
                        value={padTop}
                        min={0}
                        max={72}
                        step={2}
                        onChange={(v) => setStyle((s) => ({ ...s, textPaddingTop: v }))}
                        suffix="px"
                    />
                    <StudioStepperRow
                        label={t('studio_text_margin_bottom', 'هامش سفلي')}
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

/** @param {{ pickerId: string; openPickerId: string | null; onPickerOpen: (id: string) => void; onPickerClose: () => void; icon: import('react').ComponentType<{ size?: number }>; label: string; colorLabel: string; active: boolean; onToggle: (on: boolean) => void; color: string; onColor: (c: string) => void }} props */
function FxEffectCell({
    pickerId,
    openPickerId,
    onPickerOpen,
    onPickerClose,
    icon: Icon,
    label,
    colorLabel,
    active,
    onToggle,
    color,
    onColor,
}) {
    const applyColor = (c) => {
        if (!active) onToggle(true);
        onColor(c);
    };

    return (
        <div className={`sps-fx-cell${active ? ' is-on' : ''}`}>
            <button
                type="button"
                className="sps-fx-toggle"
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => onToggle(!active)}
            >
                <Icon size={18} aria-hidden />
                <span className="sps-fx-toggle__label">{label}</span>
            </button>
            <StudioFxColorPicker
                color={color}
                onChange={applyColor}
                open={openPickerId === pickerId}
                onOpen={() => onPickerOpen(pickerId)}
                onClose={onPickerClose}
                label={colorLabel}
            />
        </div>
    );
}

export function StudioEffectsPanel({ style, setStyle, t }) {
    const [openPickerId, setOpenPickerId] = useState(null);
    const shadowOn = style.textShadow !== false;
    const glowOn = Number(style.glowIntensity ?? 0) > 0;
    const strokeOn = Boolean(style.textStroke);

    return (
        <div className="sps-glass-panel sps-glass-panel--compact sps-effects-panel">
            <p className="sps-glass-sub">
                {t('studio_fx_pick', 'فعّل المؤثر — اضغط لوحة اللون واسحب لاختيار اللون')}
            </p>
            <div className="sps-fx-toolbar">
                <FxEffectCell
                    pickerId="shadow"
                    openPickerId={openPickerId}
                    onPickerOpen={setOpenPickerId}
                    onPickerClose={() => setOpenPickerId(null)}
                    icon={FaLayerGroup}
                    label={t('studio_text_shadow', 'ظل')}
                    colorLabel={t('studio_fx_shadow_color', 'لون الظل')}
                    active={shadowOn}
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
                    color={style.shadowColor || STUDIO_FX_DEFAULTS.shadowColor}
                    onColor={(c) => setStyle((s) => ({ ...s, shadowColor: c, textShadow: true }))}
                />
                <FxEffectCell
                    pickerId="stroke"
                    openPickerId={openPickerId}
                    onPickerOpen={setOpenPickerId}
                    onPickerClose={() => setOpenPickerId(null)}
                    icon={FaSquare}
                    label={t('studio_text_stroke', 'حد')}
                    colorLabel={t('studio_fx_stroke_color', 'لون الحد')}
                    active={strokeOn}
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
                    color={style.strokeColor || STUDIO_FX_DEFAULTS.strokeColor}
                    onColor={(c) =>
                        setStyle((s) => ({
                            ...s,
                            strokeColor: c,
                            textStroke: true,
                            strokeWidth: STUDIO_FX_DEFAULTS.strokeWidth,
                        }))
                    }
                />
                <FxEffectCell
                    pickerId="glow"
                    openPickerId={openPickerId}
                    onPickerOpen={setOpenPickerId}
                    onPickerClose={() => setOpenPickerId(null)}
                    icon={FaSun}
                    label={t('studio_glow', 'توهج')}
                    colorLabel={t('studio_fx_glow_color', 'لون التوهج')}
                    active={glowOn}
                    onToggle={(on) =>
                        setStyle((s) => ({
                            ...s,
                            titleColorMode: 'solid',
                            bodyColorMode: 'solid',
                            glowIntensity: on ? STUDIO_FX_DEFAULTS.glowIntensity : 0,
                            ...(on && !s.glowColor ? { glowColor: STUDIO_FX_DEFAULTS.glowColor } : {}),
                        }))
                    }
                    color={style.glowColor || STUDIO_FX_DEFAULTS.glowColor}
                    onColor={(c) =>
                        setStyle((s) => ({
                            ...s,
                            glowColor: c,
                            glowIntensity: STUDIO_FX_DEFAULTS.glowIntensity,
                        }))
                    }
                />
            </div>
        </div>
    );
}

export function StudioPromoPanel({ onInsertSticker, stickerCount = 0, t }) {
    const maxStickers = STUDIO_PROMO_MAX;

    return (
        <div className="sps-glass-panel sps-glass-panel--promo sps-promo-panel">
            <p className="sps-glass-sub">{t('studio_promo_pick', 'اختر أيقونة للإدراج على التصميم')}</p>
            <div className="sps-promo-panel__track" role="list">
                {STUDIO_PROMO_STICKERS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="listitem"
                        className={`sps-promo-chip sps-promo-chip--${item.variant}`}
                        style={{
                            background: item.bg || undefined,
                            color: item.color || undefined,
                        }}
                        disabled={stickerCount >= maxStickers}
                        onClick={() => onInsertSticker(item.id)}
                        title={item.display}
                    >
                        <span>{item.display}</span>
                    </button>
                ))}
            </div>
            <p className="sps-colors-panel__hint">
                {stickerCount >= maxStickers
                    ? t('studio_promo_max', 'الزوايا الأربع ممتلئة — احذف أيقونة لإضافة أخرى')
                    : t('studio_promo_hint', 'تُثبت الأيقونة في زاوية الصورة — اضغط × لحذفها')}
            </p>
        </div>
    );
}

export function StudioLayersPanel({ activeField, onSelectLayer, t }) {
    const layers = [
        { id: 'title', label: t('studio_layer_title', 'العنوان') },
        { id: 'body', label: t('studio_layer_body', 'الرسالة') },
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
