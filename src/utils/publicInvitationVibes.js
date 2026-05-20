/**
 * Public invitation UX: invite "vibe/mood" + venue category (not legacy occasion presets).
 * Private flows keep using `OCCASION_PRESETS` in `invitationTemplates.js`.
 */

/** Firestore / UI key for `inviteMood` */
export const PUBLIC_INVITE_MOOD_KEYS = [
    'social',
    'family',
    'celebratory',
    'friends',
    'new_friends',
    'formal',
];

/** Stored in `type` on public invitations — keep English values for search + Firestore. */
export const PUBLIC_VENUE_TYPES = [
    'Restaurant',
    'Cafe',
    'Bar',
    'Night Club',
    'Cinema',
    'Concert',
    'Sports Match',
];

export function publicVenueTypeI18nKey(type) {
    return `venue_type_${String(type).toLowerCase().replace(/\s+/g, '_')}`;
}

/** Map legacy `occasionType` (old public picker) → `inviteMood`. */
const LEGACY_OCCASION_TO_INVITE_MOOD = {
    Social: 'social',
    Family: 'family',
    Birthday: 'celebratory',
    Celebration: 'celebratory',
    Nightlife: 'celebratory',
    Work: 'formal',
    'Café': 'social',
    Cafe: 'social',
    Dining: 'friends',
    Gaming: 'friends',
    Cinema: 'social',
    Sports: 'social',
    Bbq: 'family',
};

/**
 * @param {string | undefined | null} occasionType
 * @returns {typeof PUBLIC_INVITE_MOOD_KEYS[number]}
 */
export function migrateLegacyOccasionToInviteMood(occasionType) {
    const k = String(occasionType || '').trim();
    if (!k) return 'social';
    return LEGACY_OCCASION_TO_INVITE_MOOD[k] || 'social';
}

/**
 * @param {string | undefined | null} type
 * @returns {typeof PUBLIC_VENUE_TYPES[number]}
 */
export function normalizePublicVenueType(type) {
    const t = String(type || '').trim();
    if (PUBLIC_VENUE_TYPES.includes(t)) return t;
    const legacy = {
        'Food Truck': 'Restaurant',
        'Fast Food': 'Restaurant',
    };
    return legacy[t] || 'Restaurant';
}
