import React from 'react';

/**
 * Miniature visual preview of invitation card layouts (not emoji-only).
 */
export default function InvitationTemplateSwatch({ templateKey, accentGradient = 'linear-gradient(135deg, #f59e0b, #d97706)' }) {
    const k = String(templateKey || '');
    const legacyToBase = {
        classic: 'photoBottom',
        hero_4_5: 'photoBottom',
        hero_1_1: 'photoBottom',
        hero_9_16: 'photoBottom',
        modern: 'photoGlass',
        elegant: 'photoChips',
        fun: 'photoBottom',
        minimal: 'photoGlass',
        premium: 'photoChips',
        fullCanvas: 'photoBottom',
        editorial: 'photoGlass',
    };
    const base = legacyToBase[k] || k || 'photoBottom';

    const variantByKey = {
        classic: 'twoActions',
        hero_4_5: 'twoActions',
        hero_1_1: 'twoActions',
        hero_9_16: 'twoActions',
        modern: 'leftRightInfo',
        elegant: 'chips',
        fun: 'singleJoin',
        minimal: 'bareMeta',
        premium: 'ctaPill',
        fullCanvas: 'singleJoin',
        editorial: 'leftRightInfo',
        photoBottom: 'twoActions',
        photoGlass: 'glass',
        photoChips: 'chips',
    };
    const variant = variantByKey[k] || variantByKey[base] || 'twoActions';
    const fullBleedKeys = new Set([
        'hero_4_5',
        'hero_1_1',
        'hero_9_16',
        'photoBottom',
        'photoGlass',
        'photoChips',
        'fullCanvas',
    ]);
    const isFullBleed = fullBleedKeys.has(k) || (k === base && fullBleedKeys.has(base));

    const card = {
        width: '100%',
        height: 76,
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
        background: '#f8fafc',
    };
    const mediaHero = {
        height: 40,
        background: accentGradient,
        position: 'relative',
    };
    const content = {
        flex: 1,
        padding: '4px 6px',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
    };

    if (isFullBleed) {
        return (
            <div aria-hidden style={{ ...card, background: '#0f172a' }}>
                <div style={{ ...mediaHero, height: '100%' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.62) 100%)' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 8, borderRadius: 999, background: 'rgba(0,0,0,0.55)' }} />
                    {base === 'photoGlass' && (
                        <div style={{ position: 'absolute', left: '14%', right: '14%', bottom: 10, top: '40%', borderRadius: 7, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.38)' }} />
                    )}
                    {base === 'photoChips' && (
                        <div style={{ position: 'absolute', left: 6, right: 6, bottom: 8, display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {[12, 10, 14].map((w, i) => (
                                <div key={i} style={{ height: 7, minWidth: w, borderRadius: 999, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.22)' }} />
                            ))}
                        </div>
                    )}
                    {base === 'photoBottom' && (
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 100%)' }} />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div aria-hidden style={card}>
            <div style={mediaHero}>
                <div style={{ position: 'absolute', top: 3, right: 4, width: 20, height: 8, borderRadius: 999, background: 'rgba(0,0,0,0.55)' }} />
                {base === 'photoGlass' && (
                    <div style={{ position: 'absolute', left: '16%', right: '16%', top: 11, bottom: 7, borderRadius: 6, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }} />
                )}
                {base === 'photoChips' && (
                    <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, display: 'flex', gap: 4 }}>
                        {[10, 12, 8, 11].map((w, i) => (
                            <div key={i} style={{ height: 6, minWidth: w, borderRadius: 999, background: 'rgba(0,0,0,0.45)' }} />
                        ))}
                    </div>
                )}
            </div>

            <div style={content}>
                <div style={{ height: 4, width: '78%', borderRadius: 2, background: '#374151' }} />
                <div style={{ height: 3, width: '58%', borderRadius: 2, background: '#9ca3af' }} />
                {(variant === 'leftRightInfo' || variant === 'bareMeta') && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
                        <div style={{ height: 3, width: '30%', borderRadius: 2, background: '#6b7280' }} />
                        <div style={{ height: 3, width: '30%', borderRadius: 2, background: '#6b7280' }} />
                    </div>
                )}
                {variant === 'chips' && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
                        {[12, 10, 14].map((w, i) => (
                            <div key={i} style={{ height: 6, minWidth: w, borderRadius: 999, background: '#e5e7eb', border: '1px solid #d1d5db' }} />
                        ))}
                    </div>
                )}
                {variant === 'glass' && (
                    <div style={{ height: 8, marginTop: 1, borderRadius: 5, background: '#f3f4f6', border: '1px solid #e5e7eb' }} />
                )}
                {variant === 'singleJoin' && (
                    <div style={{ marginTop: 'auto', height: 8, borderRadius: 4, background: '#22c55e' }} />
                )}
                {variant === 'ctaPill' && (
                    <div style={{ marginTop: 'auto', alignSelf: 'center', height: 8, width: '52%', borderRadius: 999, background: '#7c3aed' }} />
                )}
                {variant === 'twoActions' && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#6b7280' }} />
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f97316' }} />
                    </div>
                )}
            </div>
        </div>
    );
}
