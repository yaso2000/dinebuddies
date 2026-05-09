import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import './DatingCardThemeColorPanel.css';

const FALLBACK_HEX = '#d4af37';

/** Quick presets (iOS-style bottom strip, inlined above the grid). */
const PRESET_HEX = [
    '#000000',
    '#1e40af',
    '#15803d',
    '#ca8a04',
    '#dc2626',
    '#ffffff',
    '#ec4899',
    '#7c3aed',
    '#0ea5e9',
    '#14b8a6'
];

function rgbToHex({ r, g, b }) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
    return `#${[clamp(r), clamp(g), clamp(b)]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')}`;
}

function hexToRgb(hex) {
    const h = (hex || '').replace('#', '').trim();
    if (!/^[0-9A-Fa-f]{6}$/.test(h)) return { r: 212, g: 175, b: 55 };
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    };
}

/** HSL (h 0–360, s/l 0–100) → #rrggbb */
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (h < 60) [rp, gp, bp] = [c, x, 0];
    else if (h < 120) [rp, gp, bp] = [x, c, 0];
    else if (h < 180) [rp, gp, bp] = [0, c, x];
    else if (h < 240) [rp, gp, bp] = [0, x, c];
    else if (h < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];
    return rgbToHex({
        r: (rp + m) * 255,
        g: (gp + m) * 255,
        b: (bp + m) * 255
    });
}

function buildGridSwatches() {
    const list = [];
    for (let i = 0; i < 14; i++) {
        const v = Math.round((i / 13) * 255);
        list.push(rgbToHex({ r: v, g: v, b: v }));
    }
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 14; col++) {
            const h = (col / 14) * 360;
            const s = 92 - row * 11;
            const light = 22 + row * 9;
            list.push(hslToHex(h, Math.max(20, s), Math.min(88, light)));
        }
    }
    return list;
}

const GRID_SWATCHES = buildGridSwatches();

function EyeDropperIcon() {
    return (
        <svg className="dating-card-theme-color-panel__eyedropper-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
                d="M4 20.5L3.5 20C3 19.5 3 18.8 3.5 18.3L15.8 6c.4-.4 1-.4 1.4 0l2.8 2.8c.4.4.4 1 0 1.4L7.7 20.5c-.5.5-1.2.5-1.7 0L4 20.5z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M13 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
    );
}

/** Cross-browser color UI (replaces native color input — same rich UI on Android and iOS browsers). */
export default function DatingCardThemeColorPanel({ valueHex, onColorChange }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('grid');

    const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

    const effectiveHex = useMemo(() => {
        const s = typeof valueHex === 'string' ? valueHex.trim() : '';
        return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : FALLBACK_HEX;
    }, [valueHex]);

    const rgb = useMemo(() => hexToRgb(effectiveHex), [effectiveHex]);

    const commitHex = (h) => {
        if (typeof h !== 'string') return;
        const v = h.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) onColorChange?.(v);
    };

    const openEyeDropper = useCallback(async () => {
        if (!hasEyeDropper) return;
        try {
            const EyeDropperCtor = window.EyeDropper;
            const dropper = new EyeDropperCtor();
            const { sRGBHex } = await dropper.open();
            if (sRGBHex && /^#[0-9A-Fa-f]{6}$/i.test(sRGBHex)) {
                onColorChange?.(sRGBHex.toLowerCase());
            }
        } catch {
            /* user dismissed or unsupported */
        }
    }, [hasEyeDropper, onColorChange]);

    return (
        <div className="dating-card-theme-color-panel">
            <div className="dating-card-theme-color-panel__toolbar">
                {hasEyeDropper ? (
                    <button
                        type="button"
                        className="dating-card-theme-color-panel__eyedropper"
                        onClick={openEyeDropper}
                        aria-label={t('dating_color_eyedropper', { defaultValue: 'Pick color from screen' })}
                        title={t('dating_color_eyedropper', { defaultValue: 'Pick color from screen' })}
                    >
                        <EyeDropperIcon />
                    </button>
                ) : (
                    <span className="dating-card-theme-color-panel__toolbar-spacer" aria-hidden />
                )}
                <div
                    className="dating-card-theme-color-panel__tabs"
                    role="tablist"
                    aria-label={t('dating_color_tabs_aria', { defaultValue: 'Color picker mode' })}
                >
                    {[
                        { id: 'grid', label: t('dating_color_tab_grid', { defaultValue: 'Grid' }) },
                        { id: 'spectrum', label: t('dating_color_tab_spectrum', { defaultValue: 'Spectrum' }) },
                        { id: 'sliders', label: t('dating_color_tab_sliders', { defaultValue: 'Sliders' }) }
                    ].map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            className={`dating-card-theme-color-panel__tab ${tab === id ? 'dating-card-theme-color-panel__tab--active' : ''}`}
                            onClick={() => setTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div
                className="dating-card-theme-color-panel__presets"
                role="group"
                aria-label={t('dating_color_presets_aria', { defaultValue: 'Quick color presets' })}
            >
                {PRESET_HEX.map((hex) => (
                    <button
                        key={hex}
                        type="button"
                        className={`dating-card-theme-color-panel__preset ${
                            hex.toLowerCase() === effectiveHex.toLowerCase() ? 'dating-card-theme-color-panel__preset--sel' : ''
                        }`}
                        style={{ backgroundColor: hex }}
                        onClick={() => commitHex(hex)}
                        aria-label={hex}
                    />
                ))}
            </div>

            <div className="dating-card-theme-color-panel__body" role="tabpanel">
                {tab === 'grid' && (
                    <div className="dating-card-theme-color-panel__grid dating-card-theme-color-panel__grid--dense">
                        {GRID_SWATCHES.map((hex) => (
                            <button
                                key={hex}
                                type="button"
                                className={`dating-card-theme-color-panel__swatch ${
                                    hex.toLowerCase() === effectiveHex.toLowerCase() ? 'dating-card-theme-color-panel__swatch--sel' : ''
                                }`}
                                style={{ backgroundColor: hex }}
                                onClick={() => commitHex(hex)}
                                aria-label={hex}
                            />
                        ))}
                    </div>
                )}

                {tab === 'spectrum' && (
                    <div className="dating-card-theme-color-panel__spectrum">
                        <HexColorPicker color={effectiveHex} onChange={(h) => onColorChange?.(h)} />
                    </div>
                )}

                {tab === 'sliders' && (
                    <div className="dating-card-theme-color-panel__rgb-sliders">
                        {(['r', 'g', 'b']).map((ch) => (
                            <div key={ch} className="dating-card-theme-color-panel__rgb-row">
                                <span className="dating-card-theme-color-panel__rgb-key">{ch.toUpperCase()}</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={255}
                                    value={rgb[ch]}
                                    className={`dating-card-theme-color-panel__range dating-card-theme-color-panel__range--${ch}`}
                                    onChange={(e) =>
                                        commitHex(
                                            rgbToHex({
                                                ...rgb,
                                                [ch]: Number(e.target.value)
                                            })
                                        )
                                    }
                                />
                                <span className="dating-card-theme-color-panel__rgb-val">{rgb[ch]}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="dating-card-theme-color-panel__footer">
                <div
                    className="dating-card-theme-color-panel__preview"
                    style={{ backgroundColor: effectiveHex }}
                    aria-hidden
                />
                <label className="dating-card-theme-color-panel__hex-wrap">
                    <span className="dating-card-theme-color-panel__hex-label">
                        {t('dating_color_hex_label', { defaultValue: 'Hex' })}
                    </span>
                    <HexColorInput
                        className="dating-card-theme-color-panel__hex-input"
                        color={effectiveHex}
                        onChange={(next) => {
                            if (typeof next === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(next.trim())) {
                                onColorChange?.(next.trim().toLowerCase());
                            }
                        }}
                        prefixed
                        aria-label={t('dating_color_hex_label', { defaultValue: 'Hex' })}
                    />
                </label>
            </div>
        </div>
    );
}
