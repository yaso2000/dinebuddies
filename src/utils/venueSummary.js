/**
 * Venue summary — composed on the CLIENT in the current UI language.
 *
 * DineBuddies translates the SYSTEM, never the CONTENT. Derived facts (type,
 * price level, rating, services) are structured data, so the one-line venue
 * summary must be assembled at render time from those fields — it then follows
 * the selected language and locale number formatting. A fixed-language string
 * must never be stored on the document (that would show e.g. Arabic prose in an
 * English UI). Real content (a Google editorial blurb or an owner-written bio)
 * is shown verbatim; only auto-generated summaries are recomposed here.
 */

const PRICE_KEY = {
  PRICE_LEVEL_FREE: ['price_level_free', 'Free'],
  PRICE_LEVEL_INEXPENSIVE: ['price_level_inexpensive', 'Budget-friendly'],
  PRICE_LEVEL_MODERATE: ['price_level_moderate', 'Moderate prices'],
  PRICE_LEVEL_EXPENSIVE: ['price_level_expensive', 'Upscale prices'],
  PRICE_LEVEL_VERY_EXPENSIVE: ['price_level_very_expensive', 'Fine dining prices'],
};

const num = (v) => (typeof v === 'number' ? v : Number(v));

/** Localized one-line summary built from a venue's structured fields. */
export function buildVenueSummary(venue, t, i18n) {
  if (!venue) return '';
  const bi = venue.businessInfo || {};
  const type = String(venue.businessType || bi.businessType || venue.type || '').trim();
  const city = String(venue.city || bi.city || '').trim();
  const locale = (i18n && i18n.language) || 'en';
  let nf;
  try { nf = new Intl.NumberFormat(locale); } catch { nf = new Intl.NumberFormat('en'); }

  const parts = [];

  const typeLabel = type ? t(`type_${type.toLowerCase().replace(/\s+/g, '')}`, type) : '';
  if (typeLabel && city) parts.push(t('venue_summary_type_city', '{{type}} in {{city}}', { type: typeLabel, city }));
  else if (typeLabel) parts.push(typeLabel);
  else if (city) parts.push(city);

  const priceLevel = String(bi.priceLevel || venue.priceLevel || '').trim();
  if (PRICE_KEY[priceLevel]) parts.push(t(PRICE_KEY[priceLevel][0], PRICE_KEY[priceLevel][1]));

  const rating = num(bi.googlePlaceRating ?? venue.googlePlaceRating ?? bi.rating ?? venue.rating);
  if (Number.isFinite(rating) && rating > 0) {
    const count = num(bi.userRatingCount ?? venue.userRatingCount);
    let s = t('venue_summary_rating', '{{rating}} of 5', { rating: nf.format(Number(rating.toFixed(1))) });
    if (Number.isFinite(count) && count > 0) {
      s += ' ' + t('venue_summary_reviews', '({{count}} reviews)', { count: nf.format(count) });
    }
    parts.push(s);
  }

  const flags = bi.serviceFlags || venue.serviceFlags || {};
  const services = [];
  if (flags.dineIn) services.push(t('venue_service_dinein', 'dine-in'));
  if (flags.delivery) services.push(t('venue_service_delivery', 'delivery'));
  if (flags.takeout) services.push(t('venue_service_takeout', 'takeout'));
  if (services.length) {
    const sep = t('venue_service_separator', ', ');
    parts.push(t('venue_summary_offers', 'Offers {{services}}', { services: services.join(sep) }));
  }

  return parts.join(' · ');
}

/**
 * What to show as a venue's description:
 *  - real content (Google editorial / owner-written) → verbatim,
 *  - auto-generated (bioSource 'generated', or empty) → localized summary.
 */
export function venueDisplayDescription(venue, t, i18n) {
  if (!venue) return '';
  const bi = venue.businessInfo || {};
  const bioSource = String(bi.bioSource || venue.bioSource || '').trim();
  const stored = String(venue.description || bi.description || venue.bio || '').trim();
  if (stored && bioSource !== 'generated') return stored;
  return buildVenueSummary(venue, t, i18n);
}

export default venueDisplayDescription;
