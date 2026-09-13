import React, { useState } from 'react';
import { titleVisuals, titleIconUrl } from './titleDisplay';

/**
 * The visual for a TasteScope title: the generated 3D pictorial icon shown
 * inside a circular frame (which hides each render's own background/corners so
 * the ten read as one set). Falls back to the title emoji if the image is
 * missing. See titleDisplay.titleIconUrl.
 *
 * @param {string} titleId
 * @param {number} size  diameter in px (default 48)
 * @param {string} [title]  accessible label / tooltip
 */
export default function TitleGlyph({ titleId, size = 48, title, style }) {
  const [failed, setFailed] = useState(false);
  const { emoji, accent } = titleVisuals(titleId);

  const frame = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: `${accent}22`, ...style,
  };

  if (!titleId || failed) {
    return (
      <span role="img" aria-label={title} title={title} style={{ ...frame, fontSize: size * 0.58, lineHeight: 1 }}>
        {emoji}
      </span>
    );
  }

  return (
    <span aria-label={title} title={title} style={frame}>
      <img
        src={titleIconUrl(titleId)}
        alt={title || ''}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  );
}
