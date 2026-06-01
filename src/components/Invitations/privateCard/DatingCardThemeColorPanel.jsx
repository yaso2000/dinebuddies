import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './DatingCardThemeColorPanel.css';

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
export default function DatingCardThemeColorPanel({ valueHex, onColorChange, layout = 'grid', compact = false }) {
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
            className={`dating-card-theme-color-panel dating-card-theme-color-panel__presets${
                layout === 'row'
                    ? ' dating-card-theme-color-panel__presets--row'
                    : ' dating-card-theme-color-panel__presets--grid'
            }${compact ? ' dating-card-theme-color-panel__presets--compact' : ''}`}
            role="group"
            aria-label={t('dating_color_presets_aria', { defaultValue: 'Card color choices' })}
        >
            {CARD_THEME_COLOR_PRESETS.map((hex) => {
                const selected =
                    effectiveHex != null && hex.toLowerCase() === effectiveHex.toLowerCase();
                const isLight = hex.toLowerCase() === '#f1f5f9';
                return (
                    <button
                        key={hex}
                        type="button"
                        className={`dating-card-theme-color-panel__preset ${
                            selected ? 'dating-card-theme-color-panel__preset--sel' : ''
                        }${isLight ? ' dating-card-theme-color-panel__preset--light' : ''}`}
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
