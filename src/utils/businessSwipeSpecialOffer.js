/**
 * Paid Business swipe-card special offer helpers.
 * Shape stored on users.businessInfo.swipeSpecialOffer (mirrored to businessPublic).
 */

export function toDateInputValue(value) {
  if (!value) return '';
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseDayStart(value) {
  const day = toDateInputValue(value);
  if (!day) return null;
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEnd(value) {
  const day = toDateInputValue(value);
  if (!day) return null;
  const d = new Date(`${day}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {unknown} raw
 * @returns {{ title: string, imageUrl: string|null, startDate: string, endDate: string }|null}
 */
export function normalizeSwipeSpecialOffer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim().slice(0, 80);
  if (!title) return null;
  const startDate = toDateInputValue(raw.startDate || raw.startAt);
  const endDate = toDateInputValue(raw.endDate || raw.endAt);
  if (!startDate || !endDate) return null;
  const imageUrl = String(raw.imageUrl || raw.mediaUrl || '').trim() || null;
  return { title, imageUrl, startDate, endDate };
}

/**
 * Active window for display on swipe cards.
 * @param {unknown} raw
 * @param {{ now?: Date }} [opts]
 */
export function getActiveSwipeSpecialOffer(raw, opts = {}) {
  const offer = normalizeSwipeSpecialOffer(raw);
  if (!offer) return null;
  const start = parseDayStart(offer.startDate);
  const end = parseDayEnd(offer.endDate);
  if (!start || !end || end < start) return null;
  const now = opts.now instanceof Date ? opts.now : new Date();
  if (now < start || now > end) return null;
  return offer;
}

/**
 * Resolve offer from a directory/swipe restaurant-shaped object.
 */
export function resolveBusinessSwipeSpecialOffer(business) {
  if (!business || typeof business !== 'object') return null;
  return (
    business.swipeSpecialOffer ||
    business.businessInfo?.swipeSpecialOffer ||
    business.businessPublic?.swipeSpecialOffer ||
    null
  );
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * CSS custom properties for the swipe-offer banner gradient, derived from the
 * business's brand color. Falls back to the default teal-green (no vars) when
 * no brand color is set.
 * @param {{ primaryColor?: string, secondaryColor?: string }|null|undefined} brandKit
 */
export function buildSwipeOfferAccentVars(brandKit) {
  const primary = hexToRgba(brandKit?.primaryColor, 0.55);
  const secondary = hexToRgba(brandKit?.secondaryColor || brandKit?.primaryColor, 0.72);
  const border = hexToRgba(brandKit?.primaryColor, 0.42);
  if (!primary || !secondary) return undefined;
  return {
    '--offer-accent-1': primary,
    '--offer-accent-2': secondary,
    '--offer-accent-border': border || undefined,
  };
}

/**
 * CSS custom properties theming the whole partner swipe card (glow, chips,
 * join/invite/close buttons) from the business's brand color. Falls back to
 * the default teal-green (no vars → CSS defaults) when no brand color is set.
 * Brand Kit is free for all businesses, so this applies regardless of paid tier.
 * @param {{ primaryColor?: string, secondaryColor?: string }|null|undefined} brandKit
 */
export function buildPartnerCardAccentVars(brandKit) {
  const primaryHex = brandKit?.primaryColor;
  const secondaryHex = brandKit?.secondaryColor || primaryHex;
  const glow1 = hexToRgba(primaryHex, 0.38);
  const glow2 = hexToRgba(secondaryHex, 0.22);
  if (!glow1 || !glow2) return undefined;
  return {
    '--partner-accent-ring': hexToRgba(primaryHex, 0.22),
    '--partner-accent-glow-1': glow1,
    '--partner-accent-glow-2': glow2,
    '--partner-accent-chip-border': hexToRgba(primaryHex, 0.35),
    '--partner-accent-chip-bg': hexToRgba(primaryHex, 0.14),
    '--partner-accent-join-bg': `linear-gradient(145deg, ${hexToRgba(primaryHex, 0.72)}, ${hexToRgba(secondaryHex, 0.4)})`,
    '--partner-accent-join-border': hexToRgba(primaryHex, 0.55),
    '--partner-accent-invite-bg': hexToRgba(primaryHex, 0.28),
    '--partner-accent-invite-border': hexToRgba(secondaryHex, 0.48),
    '--partner-accent-close-border': hexToRgba(primaryHex, 0.4),
    '--partner-accent-close-bg': hexToRgba(primaryHex, 0.16),
  };
}

/**
 * Compact date range for card UI.
 */
export function formatSwipeOfferDateRange(offer, locale) {
  if (!offer?.startDate || !offer?.endDate) return '';
  try {
    const fmt = new Intl.DateTimeFormat(locale || undefined, {
      month: 'short',
      day: 'numeric',
    });
    const start = parseDayStart(offer.startDate);
    const end = parseDayStart(offer.endDate);
    if (!start || !end) return `${offer.startDate} – ${offer.endDate}`;
    if (offer.startDate === offer.endDate) return fmt.format(start);
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  } catch {
    return `${offer.startDate} – ${offer.endDate}`;
  }
}
