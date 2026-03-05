/**
 * generateShareCard — draws an invitation share card directly on a <canvas>
 * using the Canvas 2D API. No html2canvas, no CORS issues.
 * Returns a Promise<HTMLCanvasElement>
 */

const CARD_W = 1080;
const CARD_H = 1080;
const HERO_H = 595;
const PADDING = 56;

/** Load image via fetch→blob URL (no canvas taint), falls back to crossOrigin Image() */
const loadImg = async (src) => {
    if (!src) return null;

    // Strategy 1: fetch → blob URL (same-origin blob, no taint)
    try {
        const resp = await fetch(src, { mode: 'cors' });
        if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            return await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img); };
                img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
                img.src = blobUrl;
            });
        }
    } catch (_) { /* fall through */ }

    // Strategy 2: crossOrigin Image() (works if server sends CORS headers)
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // resolve null → gradient fallback
        img.src = src;
    });
};

/** Draw a rounded rectangle path */
const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

/** Measure text width for pill sizing */
const measureText = (ctx, text, font) => {
    ctx.save();
    ctx.font = font;
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
};

// ─────────────────────────────────────────────
//  BUSINESS / PARTNER  share card
// ─────────────────────────────────────────────
export async function generateBusinessShareCard({
    title = 'DineBuddies Partner',
    image,
    location,
    city,
    description,
    hostName,
    hostImage,
} = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    // ── Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // ── Load images in parallel
    const [heroImg, hostImg, logoImg] = await Promise.all([
        loadImg(image),
        loadImg(hostImage),
        loadImg('/db-white.svg'),
    ]);

    // ── Hero image (cover crop, same as invitation card)
    if (heroImg) {
        const scale = Math.max(CARD_W / heroImg.naturalWidth, HERO_H / heroImg.naturalHeight);
        const sw = CARD_W / scale;
        const sh = HERO_H / scale;
        const sx = (heroImg.naturalWidth - sw) / 2;
        const sy = (heroImg.naturalHeight - sh) / 2;
        ctx.drawImage(heroImg, sx, sy, sw, sh, 0, 0, CARD_W, HERO_H);
    } else {
        // Amber/orange gradient placeholder for business
        const grad = ctx.createLinearGradient(0, 0, CARD_W, HERO_H);
        grad.addColorStop(0, '#78350f');
        grad.addColorStop(0.5, '#92400e');
        grad.addColorStop(1, '#b45309');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, HERO_H);
    }

    // ── Hero gradient overlays
    const topOv = ctx.createLinearGradient(0, 0, 0, 220);
    topOv.addColorStop(0, 'rgba(0,0,0,0.65)');
    topOv.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topOv;
    ctx.fillRect(0, 0, CARD_W, 220);

    const botOv = ctx.createLinearGradient(0, HERO_H - 220, 0, HERO_H);
    botOv.addColorStop(0, 'rgba(13,17,23,0)');
    botOv.addColorStop(1, 'rgba(13,17,23,1)');
    ctx.fillStyle = botOv;
    ctx.fillRect(0, HERO_H - 220, CARD_W, 220);

    // ── Branding badge (orange for business)
    const BX = PADDING, BY = 36;
    const BADGE_SIZE = 68;
    ctx.fillStyle = '#f97316';
    roundRect(ctx, BX, BY, BADGE_SIZE, BADGE_SIZE, 16);
    ctx.fill();

    if (logoImg) {
        const PAD = 10;
        const scale = Math.min(
            (BADGE_SIZE - PAD * 2) / logoImg.naturalWidth,
            (BADGE_SIZE - PAD * 2) / logoImg.naturalHeight
        );
        const lw = logoImg.naturalWidth * scale;
        const lh = logoImg.naturalHeight * scale;
        ctx.drawImage(logoImg, BX + (BADGE_SIZE - lw) / 2, BY + (BADGE_SIZE - lh) / 2, lw, lh);
    } else {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px "Arial", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('db', BX + BADGE_SIZE / 2, BY + BADGE_SIZE / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // "Partner" tag instead of "You're Invited!"
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 34px "Arial", sans-serif';
    ctx.fillText('DineBuddies', BX + BADGE_SIZE + 16, BY + 44);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '20px "Arial", sans-serif';
    ctx.fillText('Partner Restaurant 🍽️', BX + BADGE_SIZE + 16, BY + 68);

    // ── Info panel
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, HERO_H, CARD_W, CARD_H - HERO_H);

    // ── Restaurant Name
    let curY = HERO_H + 52;
    const nameFont = `bold ${title.length > 30 ? 54 : 66}px "Arial", sans-serif`;
    const nameLineH = title.length > 30 ? 64 : 78;
    ctx.fillStyle = 'white';
    ctx.font = nameFont;
    const maxW = CARD_W - PADDING * 2;
    const words = title.split(' ');
    let line = '';
    let lineCount = 0;
    for (let i = 0; i < words.length && lineCount < 2; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, PADDING, curY);
            curY += nameLineH;
            line = words[i];
            lineCount++;
        } else { line = test; }
    }
    if (line) { ctx.fillText(line, PADDING, curY); curY += nameLineH; }
    curY += 12;

    // ── Description (up to 2 lines, 36px)
    if (description) {
        const DESC_FONT = '32px "Arial", sans-serif';
        ctx.font = DESC_FONT;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        const descWords = description.split(' ');
        let dLine = '';
        let dCount = 0;
        for (let i = 0; i < descWords.length && dCount < 2; i++) {
            const test = dLine + (dLine ? ' ' : '') + descWords[i];
            if (ctx.measureText(test).width > maxW && dLine) {
                ctx.fillText(dLine, PADDING, curY);
                curY += 44;
                dLine = descWords[i];
                dCount++;
            } else { dLine = test; }
        }
        if (dLine && dCount < 2) { ctx.fillText(dLine + (description.split(' ').length > (dLine + ' ...').split(' ').length ? '...' : ''), PADDING, curY); curY += 44; }
        curY += 16;
    }

    // ── Location pill (amber colour for business)
    const displayLocation = location || city || '';
    if (displayLocation) {
        const PILL_H = 56, PILL_R = 28;
        const PILL_FONT = 'bold 26px "Arial", sans-serif';
        ctx.font = PILL_FONT;
        const pillText = `📍 ${displayLocation}`;
        const tw = ctx.measureText(pillText).width;
        const pw = tw + 48;
        roundRect(ctx, PADDING, curY, pw, PILL_H, PILL_R);
        ctx.fillStyle = 'rgba(251,146,60,0.18)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(251,146,60,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fdba74';
        ctx.fillText(pillText, PADDING + 24, curY + 37);
        curY += PILL_H + 24;
    }

    // ── Divider
    const DIV_Y = CARD_H - 130;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, DIV_Y);
    ctx.lineTo(CARD_W - PADDING, DIV_Y);
    ctx.stroke();

    // ── Footer
    const FY = DIV_Y + 26;

    // Host avatar (business logo)
    if (hostImg) {
        const AX = PADDING, AY = FY, AS = 60;
        ctx.save();
        ctx.beginPath();
        ctx.arc(AX + AS / 2, AY + AS / 2, AS / 2, 0, Math.PI * 2);
        ctx.clip();
        const hScale = Math.max(AS / hostImg.naturalWidth, AS / hostImg.naturalHeight);
        const hw = AS / hScale, hh = AS / hScale;
        ctx.drawImage(hostImg, (hostImg.naturalWidth - hw) / 2, (hostImg.naturalHeight - hh) / 2, hw, hh, AX, AY, AS, AS);
        ctx.restore();
    }
    if (hostName) {
        const textX = PADDING + (hostImg ? 74 : 0);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '18px "Arial", sans-serif';
        ctx.fillText('Restaurant', textX, FY + 22);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 26px "Arial", sans-serif';
        ctx.fillText(hostName, textX, FY + 50);
    }

    // CTA badge — amber gradient for business
    const CTA = 'Visit Us on DineBuddies 🍽️';
    ctx.font = 'bold 24px "Arial", sans-serif';
    const ctaW = ctx.measureText(CTA).width + 64;
    const ctaX = CARD_W - PADDING - ctaW;
    const ctaGrad = ctx.createLinearGradient(ctaX, 0, ctaX + ctaW, 0);
    ctaGrad.addColorStop(0, '#f97316');
    ctaGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = ctaGrad;
    roundRect(ctx, ctaX, FY, ctaW, 64, 32);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(CTA, ctaX + 32, FY + 43);

    return canvas;
}

// ─────────────────────────────────────────────
//  INVITATION  share card
// ─────────────────────────────────────────────
export async function generateShareCard({
    title = 'DineBuddies Event',
    image,
    date,
    time,
    location,
    city,
    maxGuests,
    hostName,
    hostImage,
} = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    // ── Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // ── Load images in parallel
    const [heroImg, hostImg] = await Promise.all([loadImg(image), loadImg(hostImage)]);

    // ── Hero image (cover crop)
    if (heroImg) {
        const scale = Math.max(CARD_W / heroImg.naturalWidth, HERO_H / heroImg.naturalHeight);
        const sw = CARD_W / scale;
        const sh = HERO_H / scale;
        const sx = (heroImg.naturalWidth - sw) / 2;
        const sy = (heroImg.naturalHeight - sh) / 2;
        ctx.drawImage(heroImg, sx, sy, sw, sh, 0, 0, CARD_W, HERO_H);
    } else {
        // Gradient placeholder
        const grad = ctx.createLinearGradient(0, 0, CARD_W, HERO_H);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.5, '#312e81');
        grad.addColorStop(1, '#4c1d95');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, HERO_H);
    }

    // ── Hero gradient overlays
    const topOverlay = ctx.createLinearGradient(0, 0, 0, 220);
    topOverlay.addColorStop(0, 'rgba(0,0,0,0.65)');
    topOverlay.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topOverlay;
    ctx.fillRect(0, 0, CARD_W, 220);

    const botOverlay = ctx.createLinearGradient(0, HERO_H - 220, 0, HERO_H);
    botOverlay.addColorStop(0, 'rgba(13,17,23,0)');
    botOverlay.addColorStop(1, 'rgba(13,17,23,1)');
    ctx.fillStyle = botOverlay;
    ctx.fillRect(0, HERO_H - 220, CARD_W, 220);

    // ── DineBuddies branding (top-left)
    const BX = PADDING, BY = 36;
    const BADGE_SIZE = 68;

    // Load white version of DineBuddies logo (for use on orange badge)
    const logoImg = await loadImg('/db-white.svg');

    // Orange badge (DineBuddies brand color) + white logo
    ctx.fillStyle = '#f97316';
    roundRect(ctx, BX, BY, BADGE_SIZE, BADGE_SIZE, 16);
    ctx.fill();

    if (logoImg) {
        // Draw logo centered in the badge with padding
        const PAD = 10;
        const scale = Math.min(
            (BADGE_SIZE - PAD * 2) / logoImg.naturalWidth,
            (BADGE_SIZE - PAD * 2) / logoImg.naturalHeight
        );
        const lw = logoImg.naturalWidth * scale;
        const lh = logoImg.naturalHeight * scale;
        const lx = BX + (BADGE_SIZE - lw) / 2;
        const ly = BY + (BADGE_SIZE - lh) / 2;
        ctx.drawImage(logoImg, lx, ly, lw, lh);
    } else {
        // Fallback: draw 'db' text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px "Arial", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('db', BX + BADGE_SIZE / 2, BY + BADGE_SIZE / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // Brand name text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 34px "Arial", sans-serif';
    ctx.fillText('DineBuddies', BX + BADGE_SIZE + 16, BY + 44);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '20px "Arial", sans-serif';
    ctx.fillText("You're Invited!", BX + BADGE_SIZE + 16, BY + 68);

    // ── Info panel background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, HERO_H, CARD_W, CARD_H - HERO_H);

    // ── Title
    let curY = HERO_H + 48;
    const titleFont = `bold ${title.length > 35 ? 52 : 64}px "Arial", sans-serif`;
    const titleLineH = title.length > 35 ? 62 : 76;
    ctx.fillStyle = 'white';
    ctx.font = titleFont;
    const maxTitleW = CARD_W - PADDING * 2;
    const words = title.split(' ');
    let line = '';
    let lineCount = 0;
    for (let i = 0; i < words.length && lineCount < 2; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxTitleW && line) {
            ctx.fillText(line, PADDING, curY);
            curY += titleLineH;
            line = words[i];
            lineCount++;
        } else {
            line = test;
        }
    }
    if (line) { ctx.fillText(line, PADDING, curY); curY += titleLineH; }
    curY += 20;

    // ── Info pills
    const PILL_H = 56, PILL_R = 28;
    const PILL_FONT = 'bold 26px "Arial", sans-serif';
    ctx.font = PILL_FONT;

    const pills = [
        date && { text: `📅 ${date}${time ? ` · ${time}` : ''}`, bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.4)', color: '#c4b5fd' },
        (location || city) && { text: `📍 ${location || city}`, bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.35)', color: '#f9a8d4' },
        maxGuests && { text: `👥 Max ${maxGuests}`, bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#6ee7b7' },
    ].filter(Boolean);

    let pillX = PADDING;
    let pillRow = 0;
    for (const p of pills) {
        ctx.font = PILL_FONT;
        const tw = ctx.measureText(p.text).width;
        const pw = tw + 48;
        if (pillX + pw > CARD_W - PADDING && pillRow === 0) {
            pillX = PADDING; curY += PILL_H + 12; pillRow++;
        }
        roundRect(ctx, pillX, curY, pw, PILL_H, PILL_R);
        ctx.fillStyle = p.bg;
        ctx.fill();
        ctx.strokeStyle = p.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.font = PILL_FONT;
        ctx.fillText(p.text, pillX + 24, curY + 37);
        pillX += pw + 14;
    }
    curY += PILL_H + 24;

    // ── Divider
    const DIV_Y = CARD_H - 130;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, DIV_Y);
    ctx.lineTo(CARD_W - PADDING, DIV_Y);
    ctx.stroke();

    // ── Footer
    const FY = DIV_Y + 26;

    // Host info
    if (hostImg) {
        const AX = PADDING, AY = FY, AS = 60;
        ctx.save();
        ctx.beginPath();
        ctx.arc(AX + AS / 2, AY + AS / 2, AS / 2, 0, Math.PI * 2);
        ctx.clip();
        const hScale = Math.max(AS / hostImg.naturalWidth, AS / hostImg.naturalHeight);
        const hw = AS / hScale, hh = AS / hScale;
        const hx = (hostImg.naturalWidth - hw) / 2, hy = (hostImg.naturalHeight - hh) / 2;
        ctx.drawImage(hostImg, hx, hy, hw, hh, AX, AY, AS, AS);
        ctx.restore();
        if (hostName) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '18px "Arial", sans-serif';
            ctx.fillText('Hosted by', AX + AS + 14, FY + 22);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 26px "Arial", sans-serif';
            ctx.fillText(hostName, AX + AS + 14, FY + 50);
        }
    } else if (hostName) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '18px "Arial", sans-serif';
        ctx.fillText('Hosted by', PADDING, FY + 22);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 26px "Arial", sans-serif';
        ctx.fillText(hostName, PADDING, FY + 50);
    }

    // CTA badge (right side)
    const CTA = 'Join on DineBuddies ✨';
    ctx.font = 'bold 26px "Arial", sans-serif';
    const ctaW = ctx.measureText(CTA).width + 64;
    const ctaX = CARD_W - PADDING - ctaW;
    const ctaGrad = ctx.createLinearGradient(ctaX, 0, ctaX + ctaW, 0);
    ctaGrad.addColorStop(0, '#8b5cf6');
    ctaGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = ctaGrad;
    roundRect(ctx, ctaX, FY, ctaW, 64, 32);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(CTA, ctaX + 32, FY + 43);

    return canvas;
}

/** Returns a PNG blob — pass type='partner' for business card */
export const generateShareCardBlob = async (data, type = 'invitation') => {
    const canvas = type === 'partner'
        ? await generateBusinessShareCard(data)
        : await generateShareCard(data);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
};

/** Returns a PNG data URL — pass type='partner' for business card */
export const generateShareCardDataUrl = async (data, type = 'invitation') => {
    const canvas = type === 'partner'
        ? await generateBusinessShareCard(data)
        : await generateShareCard(data);
    return canvas.toDataURL('image/png');
};
