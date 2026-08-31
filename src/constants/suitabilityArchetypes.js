/**
 * "Who suits you?" (مَن يناسبك؟) — a fixed set of warm, flattering PARTNER
 * ARCHETYPES. A person publishes their card on the stories rail; the crowd votes
 * which of these types would suit them best. The types describe personality and
 * vibe only — never looks — so the result always reads as kind, never a judgment
 * of the person themselves.
 *
 * The set is intentionally small and fixed. Ids are stable keys stored in
 * Firestore; do not rename an existing id (add/retire instead).
 */
export const SUITABILITY_ARCHETYPES = [
    { id: 'adventurer', emoji: '🧭', color: '#0ea5e9', ar: 'المغامر', en: 'The Adventurer', descAr: 'يحب الاكتشاف والتجارب الجديدة', descEn: 'Loves discovery and new experiences' },
    { id: 'warm', emoji: '🤍', color: '#f472b6', ar: 'الحنون', en: 'The Warm-hearted', descAr: 'دافئ ومهتم ويشعرك بالأمان', descEn: 'Warm, caring, makes you feel safe' },
    { id: 'ambitious', emoji: '🚀', color: '#8b5cf6', ar: 'الطموح', en: 'The Ambitious', descAr: 'عنده هدف وشغف بالإنجاز', descEn: 'Driven, with a passion to achieve' },
    { id: 'playful', emoji: '😄', color: '#f59e0b', ar: 'المرح', en: 'The Playful', descAr: 'خفيف الظل ويحوّل اليوم لمتعة', descEn: 'Light-hearted, turns the day into fun' },
    { id: 'calm', emoji: '🌿', color: '#10b981', ar: 'الهادئ', en: 'The Calm', descAr: 'متزن وصبور ومريح للقلب', descEn: 'Grounded, patient, easy on the heart' },
    { id: 'intellectual', emoji: '📚', color: '#6366f1', ar: 'المثقف', en: 'The Thinker', descAr: 'فضولي ويحب الحوار العميق', descEn: 'Curious, loves deep conversation' },
    { id: 'romantic', emoji: '🌹', color: '#e11d48', ar: 'الرومانسي', en: 'The Romantic', descAr: 'يعبّر عن مشاعره ويهتم باللحظات', descEn: 'Expressive, treasures the little moments' },
    { id: 'dependable', emoji: '🛡️', color: '#0d9488', ar: 'السند', en: 'The Rock', descAr: 'يُعتمد عليه وواقعي وصادق', descEn: 'Dependable, grounded and honest' },
];

export const SUITABILITY_ARCHETYPE_IDS = SUITABILITY_ARCHETYPES.map((a) => a.id);

const BY_ID = SUITABILITY_ARCHETYPES.reduce((acc, a) => { acc[a.id] = a; return acc; }, {});

export function getArchetype(id) {
    return BY_ID[id] || null;
}

/** Localized label/description for an archetype id, honoring the active language. */
export function archetypeLabel(id, lang = 'ar') {
    const a = BY_ID[id];
    if (!a) return '';
    return String(lang).startsWith('ar') ? a.ar : a.en;
}

export function archetypeDesc(id, lang = 'ar') {
    const a = BY_ID[id];
    if (!a) return '';
    return String(lang).startsWith('ar') ? a.descAr : a.descEn;
}

/** How long a suitability post stays live on the rail. */
export const SUITABILITY_POST_TTL_MS = 24 * 60 * 60 * 1000;
