/** Preset vibe & interest tags for private-enabled profiles (`users.diningPersona`). */
export const DINING_PERSONA_PRESETS = [
    '☕ Coffee',
    '🚶 Walking',
    '🍿 Cinema',
    '🍣 Sushi',
    '🎨 Art',
    '🍕 Pizza',
    '🥗 Healthy',
    '🌮 Street Food',
    '🎵 Live Music',
    '🏃 Running',
];

export const DINING_PERSONA_MAX_TAGS = 8;
export const DINING_PERSONA_MAX_TAG_LENGTH = 28;
export const FIRST_DATE_PLACE_HINT_MAX = 30;

export const JOIN_REASON_MAX = 2;

/** Why the member joined (`users.joinReasons` — stable ids, max 2). */
export const JOIN_REASON_OPTIONS = [
    {
        id: 'explore_places',
        labelKey: 'join_reason_explore_places',
        fallback: 'Exploring new places & experiences 🗺️',
    },
    {
        id: 'activity_partner',
        labelKey: 'join_reason_activity_partner',
        fallback: 'Partner for activities & events 🎟️',
    },
    {
        id: 'new_friends',
        labelKey: 'join_reason_new_friends',
        fallback: 'Making new friends 👋',
    },
    {
        id: 'expand_network',
        labelKey: 'join_reason_expand_network',
        fallback: 'Expanding my network 🤝',
    },
    {
        id: 'fun_hangouts',
        labelKey: 'join_reason_fun_hangouts',
        fallback: 'Fun hangouts & great conversation ☕',
    },
    {
        id: 'open_to_dating',
        labelKey: 'join_reason_open_to_dating',
        fallback: "I'm open to dating 💕",
        privateOnly: true,
    },
];

const JOIN_REASON_IDS = new Set(JOIN_REASON_OPTIONS.map((o) => o.id));
const PRIVATE_ONLY_JOIN_REASON_IDS = new Set(
    JOIN_REASON_OPTIONS.filter((o) => o.privateOnly).map((o) => o.id)
);

export function getJoinReasonOptions({ includePrivateOnly = true } = {}) {
    if (includePrivateOnly) return JOIN_REASON_OPTIONS;
    return JOIN_REASON_OPTIONS.filter((o) => !o.privateOnly);
}

/** Who may send private invites (`users.invitePreference`). */
export const INVITE_PREFERENCE_OPTIONS = [
    { value: 'any', labelKey: 'invite_pref_any', fallback: 'Anyone', icon: 'any' },
    { value: 'male_only', labelKey: 'invite_pref_male_only', fallback: 'Men only', icon: 'male' },
    { value: 'female_only', labelKey: 'invite_pref_female_only', fallback: 'Women only', icon: 'female' },
];

export function getJoinReasonLabel(id, t) {
    const opt = JOIN_REASON_OPTIONS.find((o) => o.id === id);
    if (!opt) return '';
    return t(opt.labelKey, opt.fallback);
}

export function normalizeDiningPersona(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        const tag = String(item || '').trim();
        if (!tag || seen.has(tag.toLowerCase())) continue;
        seen.add(tag.toLowerCase());
        out.push(tag.slice(0, DINING_PERSONA_MAX_TAG_LENGTH));
        if (out.length >= DINING_PERSONA_MAX_TAGS) break;
    }
    return out;
}

export function normalizeJoinReasons(raw, { includePrivateOnly = true } = {}) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        const id = String(item || '').trim();
        if (!JOIN_REASON_IDS.has(id) || out.includes(id)) continue;
        if (!includePrivateOnly && PRIVATE_ONLY_JOIN_REASON_IDS.has(id)) continue;
        out.push(id);
        if (out.length >= JOIN_REASON_MAX) break;
    }
    return out;
}

export function normalizeInvitePreference(raw) {
    const v = String(raw || 'any').trim().toLowerCase();
    if (v === 'male_only' || v === 'female_only') return v;
    return 'any';
}

export function normalizeFirstDatePlaceHint(raw) {
    return String(raw || '').trim().slice(0, FIRST_DATE_PLACE_HINT_MAX);
}
