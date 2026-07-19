import tzlookup from 'tz-lookup';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const WEEKDAY_TO_KEY = {
  sun: 'sunday',
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
};

const COUNTRY_TIMEZONES = {
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  QA: 'Asia/Qatar',
  KW: 'Asia/Kuwait',
  BH: 'Asia/Bahrain',
  OM: 'Asia/Muscat',
  EG: 'Africa/Cairo',
  JO: 'Asia/Amman',
  LB: 'Asia/Beirut',
  IQ: 'Asia/Baghdad',
  TR: 'Europe/Istanbul',
  GB: 'Europe/London',
  UK: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  IN: 'Asia/Kolkata',
  PK: 'Asia/Karachi',
  SG: 'Asia/Singapore',
  JP: 'Asia/Tokyo',
  NZ: 'Pacific/Auckland',
};

/**
 * Resolve IANA timezone for a business from explicit zone, coords, or country.
 * @param {{
 *   timeZone?: string|null,
 *   timezone?: string|null,
 *   lat?: number|null,
 *   lng?: number|null,
 *   countryCode?: string|null,
 *   country?: string|null,
 * }} [location]
 */
export function resolveBusinessTimeZone(location = {}) {
  const explicit = String(location.timeZone || location.timezone || '').trim();
  if (explicit) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: explicit });
      return explicit;
    } catch {
      /* fall through */
    }
  }

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      const zone = tzlookup(lat, lng);
      if (zone) return zone;
    } catch {
      /* fall through */
    }
  }

  const code = String(location.countryCode || '')
    .trim()
    .toUpperCase();
  if (code && COUNTRY_TIMEZONES[code]) return COUNTRY_TIMEZONES[code];

  const country = String(location.country || '').toLowerCase();
  if (country.includes('emirates') || country.includes('dubai') || country.includes('أبوظبي') || country.includes('دبي')) {
    return 'Asia/Dubai';
  }
  if (country.includes('saudi') || country.includes('arabia')) return 'Asia/Riyadh';
  if (country.includes('qatar')) return 'Asia/Qatar';
  if (country.includes('australia')) return 'Australia/Sydney';

  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Local calendar day + HH:mm at the business timezone.
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {{ dayKey: string, timeHm: string, timeZone: string }}
 */
export function getBusinessLocalClock(now = new Date(), timeZone) {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekday = String(parts.find((p) => p.type === 'weekday')?.value || 'Sun')
    .slice(0, 3)
    .toLowerCase();
  const hour = String(parts.find((p) => p.type === 'hour')?.value || '00').padStart(2, '0');
  const minute = String(parts.find((p) => p.type === 'minute')?.value || '00').padStart(2, '0');
  const dayKey = WEEKDAY_TO_KEY[weekday] || DAY_KEYS[now.getDay()];

  return {
    dayKey,
    timeHm: `${hour}:${minute}`,
    timeZone: zone,
  };
}

function hasBusinessHoursSchedule(hours) {
  if (!hours || typeof hours !== 'object') return false;
  return DAY_KEYS.some((day) => hours[day] && typeof hours[day] === 'object');
}

/**
 * Shared open/closed check (supports overnight close <= open) in business local time.
 * @param {Record<string, { closed?: boolean, open?: string, close?: string }>|null|undefined} hours
 * @param {{
 *   now?: Date,
 *   timeZone?: string|null,
 *   lat?: number|null,
 *   lng?: number|null,
 *   countryCode?: string|null,
 *   country?: string|null,
 * }} [options]
 * @returns {boolean|null}
 */
export function isOpenFromBusinessHours(hours, options = {}) {
  if (!hasBusinessHoursSchedule(hours)) return null;

  const zone = resolveBusinessTimeZone(options);
  const { dayKey, timeHm } = getBusinessLocalClock(options.now || new Date(), zone);
  const today = hours[dayKey];

  if (!today || today.closed) return false;
  if (!today.open || !today.close) return false;

  // Overnight window e.g. 09:00 → 01:00 or 18:30 → 00:30
  if (today.close <= today.open) {
    return timeHm >= today.open || timeHm < today.close;
  }
  return timeHm >= today.open && timeHm < today.close;
}

export { DAY_KEYS, hasBusinessHoursSchedule };
