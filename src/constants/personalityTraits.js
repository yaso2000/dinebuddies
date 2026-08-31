/**
 * Well-known, positive personality traits the card owner picks from (exactly 3)
 * for a "Who suits you?" card — shown on the card instead of a free-text bio.
 * Ids are stable keys stored in Firestore; ar/en labels are self-contained (no i18n
 * keys needed). Kept intentionally common and flattering.
 */
export const PERSONALITY_TRAITS = [
    { id: 'generous', emoji: '🎁', ar: 'كريم', en: 'Generous' },
    { id: 'romantic', emoji: '🌹', ar: 'رومانسي', en: 'Romantic' },
    { id: 'funny', emoji: '😄', ar: 'مرح', en: 'Fun' },
    { id: 'ambitious', emoji: '🚀', ar: 'طموح', en: 'Ambitious' },
    { id: 'kind', emoji: '🤍', ar: 'حنون', en: 'Kind-hearted' },
    { id: 'honest', emoji: '🕊️', ar: 'صادق', en: 'Honest' },
    { id: 'cultured', emoji: '📚', ar: 'مثقف', en: 'Cultured' },
    { id: 'calm', emoji: '🌿', ar: 'هادئ', en: 'Calm' },
    { id: 'adventurous', emoji: '🧭', ar: 'مغامر', en: 'Adventurous' },
    { id: 'confident', emoji: '✨', ar: 'واثق', en: 'Confident' },
    { id: 'goodhearted', emoji: '💛', ar: 'طيّب', en: 'Good-hearted' },
    { id: 'smart', emoji: '🧠', ar: 'ذكي', en: 'Smart' },
    { id: 'wellmannered', emoji: '🌟', ar: 'خلوق', en: 'Well-mannered' },
    { id: 'social', emoji: '👥', ar: 'اجتماعي', en: 'Sociable' },
    { id: 'patient', emoji: '⏳', ar: 'صبور', en: 'Patient' },
    { id: 'loyal', emoji: '🛡️', ar: 'وفيّ', en: 'Loyal' },
];

export const TRAITS_REQUIRED = 3;

const BY_ID = PERSONALITY_TRAITS.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

export function getTrait(id) {
    return BY_ID[id] || null;
}

export function traitLabel(id, lang = 'ar') {
    const tr = BY_ID[id];
    if (!tr) return '';
    return String(lang).startsWith('ar') ? tr.ar : tr.en;
}

/** Keep only valid, unique trait ids (max TRAITS_REQUIRED). */
export function normalizeTraits(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        const id = String(item || '').trim().toLowerCase();
        if (BY_ID[id] && !out.includes(id)) out.push(id);
        if (out.length >= TRAITS_REQUIRED) break;
    }
    return out;
}
