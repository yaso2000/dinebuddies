/**
 * Pick One — 1080×1920 story card drawn on a canvas. Never throws on a missing
 * image (background or champion): falls back to gradients / colored circle.
 * Returns a Blob (PNG). See PICKONE_SPEC.md §5.
 */
import { STORY_BG } from './pickoneData';

const W = 1080;
const H = 1920;
const FONT = "'Readex Pro', 'Cairo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFonts() {
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load(`900 96px ${FONT}`),
        document.fonts.load(`700 44px ${FONT}`),
      ]);
    }
  } catch { /* draw with whatever is available */ }
}

/** Draw `img` covering the rect (like object-fit: cover). */
function drawCover(ctx, img, x, y, w, h, focusY = 0.35) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r;
  const sh = h / r;
  const sx = (img.width - sw) / 2;
  const sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) * focusY));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fitFont(ctx, text, weight, startPx, minPx, maxWidth) {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 4;
  }
  ctx.font = `${weight} ${px}px ${FONT}`;
  return px;
}

function toBlob(canvas) {
  return new Promise((resolve) => {
    try {
      if (canvas.toBlob) { canvas.toBlob((b) => resolve(b || dataUrlToBlob(canvas)), 'image/png'); return; }
    } catch { /* fall through */ }
    resolve(dataUrlToBlob(canvas));
  });
}

function dataUrlToBlob(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * @param {object} p
 * @param {object} p.entry        champion entry { name, image, color }
 * @param {string} p.name         display name (already localized)
 * @param {'global'|'arab'} p.region
 * @param {boolean} p.rtl
 * @param {{caption:string, beat:string, play:string}} p.text  localized strings
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function renderStoryCard({ entry, name, region, rtl, text }) {
  await ensureFonts();
  const [bg, portrait, logo] = await Promise.all([
    loadImage(STORY_BG[region] || STORY_BG.global),
    loadImage(entry?.image),
    loadImage('/db-logo-white.svg'),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const accent = entry?.color || '#ef4444';

  // 1. Background
  if (bg) {
    drawCover(ctx, bg, 0, 0, W, H, 0.5);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, region === 'arab' ? '#1a1206' : '#0f0a1f');
    g.addColorStop(1, '#050408');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft spotlight
    const s = ctx.createRadialGradient(W / 2, 700, 40, W / 2, 700, 900);
    s.addColorStop(0, `${accent}55`);
    s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, W, H);
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.direction = rtl ? 'rtl' : 'ltr';

  // 2. Caption
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  fitFont(ctx, text.caption, 800, 52, 34, 920);
  ctx.fillText(text.caption, W / 2, 300);

  // 3. Champion circle
  const cx = W / 2;
  const cy = 860;
  const R = 310;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  if (portrait) {
    drawCover(ctx, portrait, cx - R, cy - R, R * 2, R * 2, 0.15);
  } else {
    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, accent);
    g.addColorStop(1, '#111');
    ctx.fillStyle = g;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `900 300px ${FONT}`;
    ctx.fillText((name || '?').trim().charAt(0), cx, cy + 10);
  }
  ctx.restore();

  // 4. Name
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  fitFont(ctx, name, 900, 100, 56, 920);
  ctx.fillText(name, W / 2, 1265);
  ctx.shadowBlur = 0;

  // 5. Sub-line
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  fitFont(ctx, text.beat, 700, 46, 30, 900);
  ctx.fillText(text.beat, W / 2, 1350);

  // 6. Footer: logo + play line
  const footerY = 1720;
  if (logo) {
    const lh = 84;
    const lw = (logo.width / logo.height) * lh || 160;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, W / 2 - lw / 2, footerY - lh / 2 - 60, lw, lh);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `900 84px ${FONT}`;
    ctx.fillText('db', W / 2, footerY - 60);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  fitFont(ctx, text.play, 700, 40, 28, 940);
  ctx.fillText(text.play, W / 2, footerY + 30);

  const blob = await toBlob(canvas);
  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}

export default renderStoryCard;
