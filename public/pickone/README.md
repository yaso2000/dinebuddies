# Pick One assets

- `singers/<entry-id>.webp` — 768×1024 (3:4 portrait), ≤120 KB. Entry ids are in
  `src/features/pickone/pickoneData.js` (e.g. `michael-jackson.webp`, `kadim-al-sahir.webp`).
  A missing file is fine: the game falls back to a colored block with the name.
- `story-bg-global.webp`, `story-bg-arab.webp` — 1080×1920 story backgrounds (no people, no text).
  Missing → gradient fallback drawn on the canvas.
