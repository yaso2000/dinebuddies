import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './PrivateCardThemeColorPanel.css';

/** Curated card theme colors — frame + text (12 choices only). */
export const CARD_THEME_COLOR_PRESETS = [
    '#d4af37',
    '#E86E2E',
    '#dc2626',
    '#ec4899',
    '#7c3aed',
    '#1e40af',
    '#0ea5e9',
    '#15803d',
    '#14b8a6',
    '#ca8a04',
    '#0f172a',
    '#f1f5f9'
];

/** Cross-browser color UI: 12 preset swatches only (no spectrum / grid / hex editor). */
export default function PrivateCardThemeColorPanel({ valueHex, onColorChange, layout = 'grid', compact = false }) {
    const { t } = useTranslation();

    const effectiveHex = useMemo(() => {
        const s = typeof valueHex === 'string' ? valueHex.trim() : '';
        if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
        return null;
    }, [valueHex]);

    const commitHex = (h) => {
        if (typeof h !== 'string') return;
        const v = h.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) onColorChange?.(v);
    };

    return (
        <div
            className={`private-card-theme-color-panel private-card-theme-color-panel__presets${
                layout === 'row'
                    ? ' private-card-theme-color-panel__presets--row'
                    : ' private-card-theme-color-panel__presets--grid'
            }${compact ? ' private-card-theme-color-panel__presets--compact' : ''}`}
            role="group"
            aria-label={t('private_color_presets_aria', { defaultValue: 'Card color choices' })}
        >
            {CARD_THEME_COLOR_PRESETS.map((hex) => {
                const selected =
                    effectiveHex != null && hex.toLowerCase() === effectiveHex.toLowerCase();
                const isLight = hex.toLowerCase() === '#f1f5f9';
                return (
                    <button
                        key={hex}
                        type="button"
                        className={`private-card-theme-color-panel__preset ${
                            selected ? 'private-card-theme-color-panel__preset--sel' : ''
                        }${isLight ? ' private-card-theme-color-panel__preset--light' : ''}`}
                        style={{ backgroundColor: hex }}
                        onClick={() => commitHex(hex)}
                        aria-label={hex}
                        aria-pressed={selected}
                    />
                );
            })}
        </div>
    );
}
