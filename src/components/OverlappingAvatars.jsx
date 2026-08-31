import React from 'react';
import { AppText } from './base';

/** Small round avatar (image or initial). */
function Dot({ src, name, size }) {
    if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-card)', background: 'var(--bg-elevated)' }} />;
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid var(--bg-card)', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.42 }}>
            {String(name || '?').charAt(0).toUpperCase()}
        </div>
    );
}

/**
 * A row of overlapping avatars (the last few people) + a "+N" remainder chip,
 * tappable to open a fuller list. Used for participants / voters — the games are
 * about connecting people, so their faces sit where a bare count used to be.
 *
 * @param {{ people: Array<{avatar?:string,name?:string}>, total?: number, size?: number, max?: number, onClick?: () => void, label?: string }} props
 */
export default function OverlappingAvatars({ people = [], total, size = 34, max = 3, onClick, label }) {
    const shown = people.slice(-max);
    const count = typeof total === 'number' ? total : people.length;
    const extra = Math.max(0, count - shown.length);
    const overlap = Math.round(size * 0.36);

    return (
        <button type="button" onClick={onClick} disabled={!onClick}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {shown.map((p, i) => (
                    <span key={i} style={{ marginInlineStart: i === 0 ? 0 : -overlap, zIndex: i + 1, display: 'inline-flex' }}>
                        <Dot src={p.avatar} name={p.name} size={size} />
                    </span>
                ))}
                {extra > 0 ? (
                    <span style={{ marginInlineStart: shown.length ? -overlap : 0, width: size, height: size, borderRadius: '50%', border: '2px solid var(--bg-card)', background: 'var(--bg-elevated)', color: 'var(--text-main)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.34, zIndex: max + 1 }}>
                        +{extra}
                    </span>
                ) : null}
            </span>
            {label ? <AppText as="span" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>{label}</AppText> : null}
        </button>
    );
}
