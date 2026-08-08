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
