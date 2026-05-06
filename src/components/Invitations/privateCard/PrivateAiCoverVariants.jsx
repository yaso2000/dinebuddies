import React from 'react';
import { useTranslation } from 'react-i18next';
import './PrivateAiCoverVariants.css';

/**
 * @param {{
 *   loading: boolean,
 *   items: ({ mimeType: string, dataBase64: string } | null)[] | null,
 *   selectedIndex: number,
 *   onSelect: (index: number) => void,
 *   dir?: 'ltr' | 'rtl',
 * }} props
 */
export default function PrivateAiCoverVariants({ loading, items, selectedIndex, onSelect, dir = 'ltr' }) {
    const { t } = useTranslation();
    const resolved = items && items.length === 3 ? items : [null, null, null];
    const anyReady = resolved.some(Boolean);
    const show = loading || anyReady;

    if (!show) return null;

    const safeIndex =
        resolved[selectedIndex] != null
            ? selectedIndex
            : resolved.findIndex((x) => x != null);
    const hero = safeIndex >= 0 ? resolved[safeIndex] : null;
    const heroSrc = hero ? `data:${hero.mimeType};base64,${hero.dataBase64}` : null;

    return (
        <div
            className="private-ai-cover-variants"
            style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}
        >
            <div className="private-ai-cover-variants__hero-col">
                <p className="private-ai-cover-variants__label">
                    {t('private_magic_pick_label', { defaultValue: 'Preview (9:16)' })}
                </p>
                <div className="private-ai-cover-variants__hero" aria-busy={loading}>
                    {loading && !heroSrc ? (
                        <div className="private-ai-cover-variants__skeleton" />
                    ) : heroSrc ? (
                        <img src={heroSrc} alt="" className="private-ai-cover-variants__hero-img" />
                    ) : (
                        <div className="private-ai-cover-variants__placeholder" />
                    )}
                </div>
            </div>
            <div className="private-ai-cover-variants__rail">
                <p className="private-ai-cover-variants__rail-label">
                    {t('private_magic_variants_rail', { defaultValue: 'Choices' })}
                </p>
                <div
                    className="private-ai-cover-variants__scroll"
                    role="radiogroup"
                    aria-label={t('private_magic_variants_rail', { defaultValue: 'Choices' })}
                >
                    {[0, 1, 2].map((i) => {
                        const data = resolved[i];
                        const sel = i === safeIndex && data != null;
                        const failed = !loading && !data;
                        return (
                            <button
                                key={i}
                                type="button"
                                role="radio"
                                aria-checked={sel}
                                disabled={loading || !data}
                                className={`private-ai-cover-variants__thumb${
                                    sel ? ' private-ai-cover-variants__thumb--selected' : ''
                                }${failed ? ' private-ai-cover-variants__thumb--failed' : ''}`}
                                onClick={() => data && onSelect(i)}
                                title={t('private_magic_variant_n', {
                                    n: i + 1,
                                    defaultValue: `Option ${i + 1}`,
                                })}
                            >
                                {loading && !data ? (
                                    <span className="private-ai-cover-variants__thumb-pulse" />
                                ) : data ? (
                                    <img
                                        src={`data:${data.mimeType};base64,${data.dataBase64}`}
                                        alt=""
                                    />
                                ) : (
                                    <span className="private-ai-cover-variants__thumb-empty">—</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
