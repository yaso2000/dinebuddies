import React from 'react';

/**
 * Taste-compatibility ring — a circular gauge for the swipe card.
 *   - The track is grey; the arc fills clockwise by `percent`.
 *   - The arc + the "db" app mark are tinted red (low) → green (high).
 *   - Centre shows the "db" mark over the percent.
 *
 * Designed to sit over a photo (glassy dark inner disc, light track), so it
 * stays legible on the discovery card. Purely visual — not a button — so it
 * never interferes with the card's tap/drag handling.
 *
 * @param {number} percent   0..100 compatibility
 * @param {number} [size=64] outer diameter in px
 * @param {number} [thickness=6] ring width in px
 */
export default function TasteCompatRing({ percent, size = 64, thickness = 6, style }) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  // Red (low) → green (high), same scale as TasteCompatibility.
  const color = `hsl(${Math.round((p / 100) * 130)}, 72%, 45%)`;
  const inner = size - thickness * 2;

  return (
    <div
      aria-label={`${p}%`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        // Colored arc up to p%, grey track for the remainder.
        background: `conic-gradient(${color} ${p * 3.6}deg, rgba(255,255,255,0.28) ${p * 3.6}deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <span
          aria-hidden
          style={{ fontSize: size * 0.26, fontWeight: 900, letterSpacing: '-0.04em', color }}
        >
          db
        </span>
        <span
          style={{ fontSize: size * 0.22, fontWeight: 900, color: '#fff', marginTop: size * 0.03 }}
        >
          {p}%
        </span>
      </div>
    </div>
  );
}
