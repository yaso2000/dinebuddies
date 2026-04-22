/**
 * generateShareCard — draws invitation / business share images on <canvas>.
 * Kept minimal for WhatsApp / social: hero image + title + copy — no fake buttons or UI chrome.
 */

const CARD_W = 1080;
const CARD_H = 1080;
const HERO_H = 640;
/** Hero height for selfie-video split layout (~top half) */
const VIDEO_SPLIT_HERO_H = 520;
const PADDING = 48;

/** Shorten URL for bottom bar */
function shortenUrlForBar(url, maxLen = 52) {
    if (!url || typeof url !== 'string') return '';
    try {
        const u = new URL(url);
        const path = u.pathname + u.search;
        const short = path.length > maxLen ? path.slice(0, maxLen - 3) + '…' : path;
        return short.startsWith('/') ? u.host + short : short;
    } catch (_) {
        return url.length > maxLen ? url.slice(0, maxLen - 3) + '…' : url;
    }
}

const getProxyImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) return null;
    try {
        const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
        const endpoint = import.meta.env.DEV ? '/__dev/proxy-image' : '/api/proxy';
        return `${base}${endpoint}?url=${encodeURIComponent(imageUrl)}`;
    } catch (_) {
        return null;
    }
};

/** Absolute http(s) URL for fetch / proxy (relative /api/* breaks server-side proxy). */
const resolveImageUrl = (src) => {
    if (!src || typeof src !== 'string') return '';
    const s = src.trim();
    if (s.startsWith('data:') || s.startsWith('blob:')) return s;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('//') && typeof window !== 'undefined' && window.location?.protocol) {
        return `${window.location.protocol}${s}`;
    }
    if (s.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${s}`;
    }
    return s;
};

const loadImg = async (src) => {
    if (!src) return null;
    const resolved = resolveImageUrl(src);
    if (!resolved) return null;

    if (resolved.startsWith('data:') || resolved.startsWith('blob:')) {
        return await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
            img.onerror = () => resolve(null);
            img.src = resolved;
        });
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const sameOrigin = origin && resolved.startsWith(origin);

    try {
        const resp = await fetch(resolved, { mode: 'cors', credentials: 'omit' });
        if (resp.ok) {
            const blob = await resp.blob();
            if (!blob || blob.size === 0) throw new Error('empty');
            const blobUrl = URL.createObjectURL(blob);
            const fromBlob = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img.naturalWidth > 0 ? img : null); };
                img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
                img.src = blobUrl;
            });
            if (fromBlob) return fromBlob;
        }
    } catch (_) { /* fall through */ }

    const imgDirect = await new Promise((resolve) => {
        const img = new Image();
        if (!sameOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
        img.onerror = () => resolve(null);
        img.src = resolved;
    });
    if (imgDirect) return imgDirect;

    const proxyUrl = getProxyImageUrl(resolved);
    if (proxyUrl) {
        try {
            const resp = await fetch(proxyUrl);
            if (resp.ok) {
                const blob = await resp.blob();
                if (!blob || blob.size === 0) return null;
                const blobUrl = URL.createObjectURL(blob);
                return await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img.naturalWidth > 0 ? img : null); };
                    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
                    img.src = blobUrl;
                });
            }
        } catch (_) { /* fall through */ }
    }
    return null;
};

/** Word-wrap and draw; returns next Y */
function drawWrappedTitle(ctx, text, x, y, maxW, fontSize, lineHeight, maxLines) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Arial", sans-serif`;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    let line = '';
    let cy = y;
    let n = 0;
    for (let i = 0; i < words.length && n < maxLines; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, cy);
            cy += lineHeight;
            n++;
            line = words[i];
        } else {
            line = test;
        }
    }
    if (line && n < maxLines) {
        ctx.fillText(line, x, cy);
        cy += lineHeight;
    }
    return cy;
}

function drawWrappedBody(ctx, text, x, y, maxW, fontSize, lineHeight, maxLines, color) {
    if (!text || !String(text).trim()) return y;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px "Arial", sans-serif`;
    const words = String(text).split(/\s+/);
    let line = '';
    let cy = y;
    let n = 0;
    for (let i = 0; i < words.length && n < maxLines; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, cy);
            cy += lineHeight;
            n++;
            line = words[i];
        } else {
            line = test;
        }
    }
    if (line && n < maxLines) {
        ctx.fillText(line, x, cy);
        cy += lineHeight;
    }
    return cy;
}

function drawMetaLine(ctx, text, x, y, maxW, fontSize, color) {
    if (!text) return y;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px "Arial", sans-serif`;
    const words = String(text).split(/\s+/);
    let line = '';
    let cy = y;
    for (let i = 0; i < words.length; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, cy);
            cy += fontSize + 10;
            line = words[i];
        } else {
            line = test;
        }
    }
    if (line) {
        ctx.fillText(line, x, cy);
        cy += fontSize + 14;
    }
    return cy;
}

function drawInvitationFullBleed(ctx, heroImg) {
    if (heroImg) {
        const scale = Math.max(CARD_W / heroImg.naturalWidth, CARD_H / heroImg.naturalHeight);
        const sw = CARD_W / scale;
        const sh = CARD_H / scale;
        const sx = (heroImg.naturalWidth - sw) / 2;
        const sy = (heroImg.naturalHeight - sh) / 2;
        ctx.drawImage(heroImg, sx, sy, sw, sh, 0, 0, CARD_W, CARD_H);
    } else {
        const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        grad.addColorStop(0, '#2a1810');
        grad.addColorStop(1, '#5c3d2e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
}

/** Top crop for video-split share card (thumbnail frame) */
function drawHeroCoverTop(ctx, heroImg, topH) {
    if (heroImg) {
        const scale = Math.max(CARD_W / heroImg.naturalWidth, topH / heroImg.naturalHeight);
        const sw = CARD_W / scale;
        const sh = topH / scale;
        const sx = (heroImg.naturalWidth - sw) / 2;
        const sy = (heroImg.naturalHeight - sh) / 2;
        ctx.drawImage(heroImg, sx, sy, sw, sh, 0, 0, CARD_W, topH);
    } else {
        const grad = ctx.createLinearGradient(0, 0, CARD_W, topH);
        grad.addColorStop(0, '#1f2937');
        grad.addColorStop(1, '#111827');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, topH);
    }
}

function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawBottomBrandAndLink(ctx, shareUrl, titleFallback) {
    const linkBarLabel = (shareUrl && shortenUrlForBar(shareUrl)) || (titleFallback && String(titleFallback).trim());
    const LINK_BAR_H = 48;
    const linkY = CARD_H - LINK_BAR_H;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, linkY, CARD_W, LINK_BAR_H);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '19px "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(linkBarLabel, CARD_W / 2, linkY + LINK_BAR_H / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const brandY = linkY - 28;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '16px "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DineBuddies', CARD_W / 2, brandY);
    ctx.textAlign = 'left';
}

// ─────────────────────────────────────────────
//  BUSINESS — hero + title + blurb + plain meta (no buttons)
// ─────────────────────────────────────────────
export async function generateBusinessShareCard({
    title = 'DineBuddies Partner',
    image,
    location,
    city,
    description,
    shareUrl,
    averageRating,
    reviewCount,
} = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const heroImg = await loadImg(image);

    if (heroImg) {
        const scale = Math.max(CARD_W / heroImg.naturalWidth, HERO_H / heroImg.naturalHeight);
        const sw = CARD_W / scale;
        const sh = HERO_H / scale;
        const sx = (heroImg.naturalWidth - sw) / 2;
        const sy = (heroImg.naturalHeight - sh) / 2;
        ctx.drawImage(heroImg, sx, sy, sw, sh, 0, 0, CARD_W, HERO_H);
    } else {
        const grad = ctx.createLinearGradient(0, 0, CARD_W, HERO_H);
        grad.addColorStop(0, '#78350f');
        grad.addColorStop(1, '#b45309');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, HERO_H);
    }

    // Subtle fade from image into content (not a "button" — just readability)
    const botOv = ctx.createLinearGradient(0, HERO_H - 120, 0, HERO_H);
    botOv.addColorStop(0, 'rgba(13,17,23,0)');
    botOv.addColorStop(1, 'rgba(13,17,23,1)');
    ctx.fillStyle = botOv;
    ctx.fillRect(0, HERO_H - 120, CARD_W, 120);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, HERO_H, CARD_W, CARD_H - HERO_H);

    const maxW = CARD_W - PADDING * 2;
    let curY = HERO_H + 44;
    const titleSize = title.length > 28 ? 52 : 60;
    const titleLH = title.length > 28 ? 62 : 72;
    curY = drawWrappedTitle(ctx, title, PADDING, curY, maxW, titleSize, titleLH, 2);
    curY += 8;

    curY = drawWrappedBody(ctx, description, PADDING, curY, maxW, 30, 42, 3, 'rgba(255,255,255,0.65)');
    curY += 10;

    const displayLocation = location || city || '';
    if (displayLocation) {
        curY = drawMetaLine(ctx, `📍 ${displayLocation}`, PADDING, curY, maxW, 26, 'rgba(255,255,255,0.78)');
    }

    if (averageRating != null || reviewCount != null) {
        const rating = Number(averageRating) || 0;
        const count = Number(reviewCount) || 0;
        const ratingText = count > 0
            ? `⭐ ${rating.toFixed(1)} · ${count} ${count === 1 ? 'review' : 'reviews'}`
            : '⭐ —';
        curY = drawMetaLine(ctx, ratingText, PADDING, curY, maxW, 24, 'rgba(253,224,71,0.9)');
    }

    drawBottomBrandAndLink(ctx, shareUrl, title);

    return canvas;
}

// ─────────────────────────────────────────────
//  INVITATION — header image + title + description + info (no buttons)
// ─────────────────────────────────────────────
export async function generateShareCard({
    title = 'DineBuddies Event',
    image,
    description,
    date,
    time,
    location,
    city,
    maxGuests,
    hostName,
    shareUrl,
    shareLayout = 'photoBottom',
    shareMeta = null,
    /** e.g. "0:09" — shown on video-split hero */
    videoDurationLabel = '',
} = {}) {
    const normalizedHostName = String(hostName || '').trim();
    const shouldShowHostName = normalizedHostName && normalizedHostName.toLowerCase() !== 'user';
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    const heroImg = await loadImg(image);

    const meta = shareMeta || {
        dateLine: date ? String(date) : '—',
        timeLine: time ? String(time) : '—',
        guestsLine: maxGuests != null && maxGuests !== '' ? String(maxGuests) : '—',
        paymentLine: '',
        distanceLine: (location || city) ? String(location || city) : '',
    };

    const maxW = CARD_W - PADDING * 2;
    const layout =
        shareLayout === 'photoGlass' || shareLayout === 'photoChips' ? shareLayout
            : shareLayout === 'videoSplit' ? 'videoSplit'
                : 'photoBottom';

    if (layout === 'videoSplit') {
        const LINK_BAR_H = 48;
        const contentBottom = CARD_H - LINK_BAR_H;

        drawHeroCoverTop(ctx, heroImg, VIDEO_SPLIT_HERO_H);

        const gBot = ctx.createLinearGradient(0, VIDEO_SPLIT_HERO_H - 150, 0, VIDEO_SPLIT_HERO_H);
        gBot.addColorStop(0, 'rgba(0,0,0,0)');
        gBot.addColorStop(1, 'rgba(0,0,0,0.82)');
        ctx.fillStyle = gBot;
        ctx.fillRect(0, VIDEO_SPLIT_HERO_H - 150, CARD_W, 150);

        const dur = String(videoDurationLabel || '').trim();
        if (dur) {
            const label = `🎥 ${dur}`;
            ctx.font = '22px "Arial", sans-serif';
            const tw = ctx.measureText(label).width;
            const pw = tw + 36;
            const px = CARD_W - PADDING - pw;
            const py = 24;
            roundRectPath(ctx, px, py, pw, 42, 21);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, px + 18, py + 21);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }

        let ty = VIDEO_SPLIT_HERO_H - 108;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const titleSize = title.length > 28 ? 40 : 48;
        const titleLH = title.length > 28 ? 48 : 56;
        ty = drawWrappedTitle(ctx, title, PADDING, ty, maxW, titleSize, titleLH, 2);
        if (description) {
            drawWrappedBody(ctx, description, PADDING, ty + 6, maxW, 22, 30, 2, 'rgba(255,255,255,0.92)');
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, VIDEO_SPLIT_HERO_H, CARD_W, contentBottom - VIDEO_SPLIT_HERO_H);

        let my = VIDEO_SPLIT_HERO_H + 32;
        ctx.fillStyle = '#111827';
        ctx.font = '26px "Arial", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const rows = [
            `📅 ${meta.dateLine}  ·  🕐 ${meta.timeLine}`,
            `👥 ${meta.guestsLine}`,
            `💳 ${meta.paymentLine || '—'}`,
        ];
        if (meta.distanceLine) rows.push(`📍 ${meta.distanceLine}`);

        rows.forEach((row, idx) => {
            ctx.fillText(row, PADDING, my);
            my += 40;
            if (idx < rows.length - 1) {
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(PADDING, my - 10);
                ctx.lineTo(CARD_W - PADDING, my - 10);
                ctx.stroke();
            }
            my += 6;
        });

        if (hostName) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '22px "Arial", sans-serif';
            ctx.fillText(String(hostName), PADDING, my + 8);
        }

        drawBottomBrandAndLink(ctx, shareUrl, title);
        return canvas;
    }

    drawInvitationFullBleed(ctx, heroImg);
    const titleLeftX = layout === 'photoBottom' ? PADDING : (CARD_W - maxW) / 2;

    if (layout === 'photoBottom') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let ty = 88;
        const titleSize = title.length > 30 ? 46 : 54;
        const titleLH = title.length > 30 ? 56 : 64;
        ty = drawWrappedTitle(ctx, title, titleLeftX, ty, maxW, titleSize, titleLH, 2);
        ty += 10;
        if (description) {
            ty = drawWrappedBody(ctx, description, titleLeftX, ty, maxW, 26, 36, 2, 'rgba(255,255,255,0.88)');
        }

        const g2 = ctx.createLinearGradient(0, CARD_H - 340, 0, CARD_H);
        g2.addColorStop(0, 'rgba(0,0,0,0)');
        g2.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, CARD_H - 340, CARD_W, 340);

        let my = CARD_H - 210;
        ctx.fillStyle = '#ffffff';
        ctx.font = '26px "Arial", sans-serif';
        ctx.fillText('📅 ' + meta.dateLine + '    ·    🕐 ' + meta.timeLine, PADDING, my);
        my += 44;
        ctx.fillText('👥 ' + meta.guestsLine + '    ·    💳 ' + (meta.paymentLine || '—'), PADDING, my);
        my += 44;
        if (meta.distanceLine) {
            ctx.fillText('📍 ' + meta.distanceLine, PADDING, my);
            my += 40;
        }
        if (hostName) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = '22px "Arial", sans-serif';
            ctx.fillText(hostName, PADDING, my);
        }
    } else if (layout === 'photoGlass') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let ty = 72;
        const titleSize = title.length > 28 ? 44 : 52;
        const titleLH = title.length > 28 ? 54 : 62;
        ty = drawWrappedTitle(ctx, title, titleLeftX, ty, maxW, titleSize, titleLH, 2);
        ty += 8;
        if (description) {
            drawWrappedBody(ctx, description, titleLeftX, ty, maxW, 24, 34, 2, 'rgba(255,255,255,0.88)');
        }

        // Keep info panel at the bottom so it never covers center of hero image.
        const bx = 56;
        const bw = CARD_W - 112;
        const by = 620;
        const bh = 340;
        roundRectPath(ctx, bx, by, bw, bh, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '26px "Arial", sans-serif';
        const rows = [
            '📅  ' + meta.dateLine,
            '🕐  ' + meta.timeLine,
            '👥  ' + meta.guestsLine,
            '💳  ' + (meta.paymentLine || '—'),
            '📍  ' + (meta.distanceLine || location || city || '—'),
        ];
        let ry = by + 28;
        rows.forEach((row, idx) => {
            ctx.fillText(row, bx + 28, ry);
            ry += 54;
            if (idx < rows.length - 1) {
                ctx.strokeStyle = 'rgba(255,255,255,0.14)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bx + 20, ry - 12);
                ctx.lineTo(bx + bw - 20, ry - 12);
                ctx.stroke();
            }
        });

        if (shouldShowHostName) {
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '22px "Arial", sans-serif';
            ctx.fillText(normalizedHostName, CARD_W / 2, by + bh + 20);
        }
    } else {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let ty = 72;
        const titleSize = title.length > 28 ? 44 : 52;
        const titleLH = title.length > 28 ? 54 : 62;
        ty = drawWrappedTitle(ctx, title, titleLeftX, ty, maxW, titleSize, titleLH, 2);
        ty += 8;
        if (description) {
            drawWrappedBody(ctx, description, titleLeftX, ty, maxW, 24, 34, 2, 'rgba(255,255,255,0.88)');
        }

        const drawChip = (text, cx, cy, chipW) => {
            const padX = 28;
            const padY = 16;
            ctx.font = '24px "Arial", sans-serif';
            const tw = ctx.measureText(text).width;
            const w = Math.min(chipW || tw + padX * 2, CARD_W - 100);
            const h = padY * 2 + 28;
            roundRectPath(ctx, cx - w / 2, cy, w, h, h / 2);
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, cy + h / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
        };

        // Move chips to lower area to avoid covering main subject.
        let cy = 700;
        drawChip('📅 ' + meta.dateLine, CARD_W / 2 - 150, cy, 400);
        drawChip('🕐 ' + meta.timeLine, CARD_W / 2 + 150, cy, 340);
        cy += 76;
        drawChip('👥 ' + meta.guestsLine, CARD_W / 2 - 150, cy, 400);
        drawChip('💳 ' + (meta.paymentLine || '—'), CARD_W / 2 + 150, cy, 360);
        cy += 76;
        if (meta.distanceLine || location || city) {
            drawChip('📍 ' + (meta.distanceLine || location || city), CARD_W / 2, cy, 620);
            cy += 76;
        }
        if (shouldShowHostName) {
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '22px "Arial", sans-serif';
            ctx.fillText(normalizedHostName, CARD_W / 2, cy + 10);
        }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    drawBottomBrandAndLink(ctx, shareUrl, title);

    return canvas;
}

export const generateShareCardBlob = async (data, type = 'invitation') => {
    const canvas = type === 'business'
        ? await generateBusinessShareCard(data)
        : await generateShareCard(data);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
};

export const generateShareCardDataUrl = async (data, type = 'invitation') => {
    const canvas = type === 'business'
        ? await generateBusinessShareCard(data)
        : await generateShareCard(data);
    return canvas.toDataURL('image/png');
};
