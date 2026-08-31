/**
 * The 12 zodiac signs — stable id keys (stored in Firestore) + icon and ar/en
 * labels (self-contained, no i18n keys). Shared by the "Guess my sign" story game.
 */
export const ZODIAC_SIGNS = [
    { id: 'aries', icon: '♈', ar: 'الحمل', en: 'Aries' },
    { id: 'taurus', icon: '♉', ar: 'الثور', en: 'Taurus' },
    { id: 'gemini', icon: '♊', ar: 'الجوزاء', en: 'Gemini' },
    { id: 'cancer', icon: '♋', ar: 'السرطان', en: 'Cancer' },
    { id: 'leo', icon: '♌', ar: 'الأسد', en: 'Leo' },
    { id: 'virgo', icon: '♍', ar: 'العذراء', en: 'Virgo' },
    { id: 'libra', icon: '♎', ar: 'الميزان', en: 'Libra' },
    { id: 'scorpio', icon: '♏', ar: 'العقرب', en: 'Scorpio' },
    { id: 'sagittarius', icon: '♐', ar: 'القوس', en: 'Sagittarius' },
    { id: 'capricorn', icon: '♑', ar: 'الجدي', en: 'Capricorn' },
    { id: 'aquarius', icon: '♒', ar: 'الدلو', en: 'Aquarius' },
    { id: 'pisces', icon: '♓', ar: 'الحوت', en: 'Pisces' },
];

export const ZODIAC_IDS = ZODIAC_SIGNS.map((s) => s.id);

/**
 * Short, well-known traits for each sign. The host picks 3 of these when creating
 * a card; the 3 are shown as text hints and the crowd guesses the sign from them.
 * Stored on the public card as {ar,en} strings (the sign itself stays server-only).
 */
export const ZODIAC_TRAITS = {
    aries: [
        { ar: 'شجاع', en: 'Brave' }, { ar: 'قيادي', en: 'A leader' }, { ar: 'مندفع', en: 'Impulsive' },
        { ar: 'متحمّس', en: 'Energetic' }, { ar: 'مغامر', en: 'Adventurous' }, { ar: 'صريح', en: 'Direct' },
    ],
    taurus: [
        { ar: 'صبور', en: 'Patient' }, { ar: 'عنيد', en: 'Stubborn' }, { ar: 'وفيّ', en: 'Loyal' },
        { ar: 'عملي', en: 'Practical' }, { ar: 'ذوّاق', en: 'Sensual' }, { ar: 'محب للراحة', en: 'Comfort-loving' },
    ],
    gemini: [
        { ar: 'فضولي', en: 'Curious' }, { ar: 'اجتماعي', en: 'Social' }, { ar: 'سريع البديهة', en: 'Witty' },
        { ar: 'متقلّب', en: 'Changeable' }, { ar: 'مرح', en: 'Playful' }, { ar: 'ثرثار', en: 'Talkative' },
    ],
    cancer: [
        { ar: 'حنون', en: 'Nurturing' }, { ar: 'عاطفي', en: 'Emotional' }, { ar: 'حسّاس', en: 'Sensitive' },
        { ar: 'عائلي', en: 'Family-first' }, { ar: 'حدسي', en: 'Intuitive' }, { ar: 'حامٍ', en: 'Protective' },
    ],
    leo: [
        { ar: 'واثق', en: 'Confident' }, { ar: 'كريم', en: 'Generous' }, { ar: 'قيادي', en: 'Regal' },
        { ar: 'محب للأضواء', en: 'Loves the spotlight' }, { ar: 'فخور', en: 'Proud' }, { ar: 'درامي', en: 'Dramatic' },
    ],
    virgo: [
        { ar: 'دقيق', en: 'Precise' }, { ar: 'منظّم', en: 'Organized' }, { ar: 'عملي', en: 'Practical' },
        { ar: 'تحليلي', en: 'Analytical' }, { ar: 'خدوم', en: 'Helpful' }, { ar: 'مثالي', en: 'Perfectionist' },
    ],
    libra: [
        { ar: 'دبلوماسي', en: 'Diplomatic' }, { ar: 'عادل', en: 'Fair' }, { ar: 'ساحر', en: 'Charming' },
        { ar: 'محب للجمال', en: 'Loves beauty' }, { ar: 'متردّد', en: 'Indecisive' }, { ar: 'أنيق', en: 'Graceful' },
    ],
    scorpio: [
        { ar: 'غامض', en: 'Mysterious' }, { ar: 'شغوف', en: 'Intense' }, { ar: 'عميق', en: 'Deep' },
        { ar: 'قوي', en: 'Powerful' }, { ar: 'غيور', en: 'Jealous' }, { ar: 'مخلص', en: 'Devoted' },
    ],
    sagittarius: [
        { ar: 'مغامر', en: 'Adventurous' }, { ar: 'متفائل', en: 'Optimistic' }, { ar: 'محب للحرية', en: 'Free-spirited' },
        { ar: 'صريح', en: 'Blunt' }, { ar: 'فيلسوف', en: 'Philosophical' }, { ar: 'مرح', en: 'Fun' },
    ],
    capricorn: [
        { ar: 'طموح', en: 'Ambitious' }, { ar: 'منضبط', en: 'Disciplined' }, { ar: 'جادّ', en: 'Serious' },
        { ar: 'مسؤول', en: 'Responsible' }, { ar: 'صبور', en: 'Patient' }, { ar: 'عملي', en: 'Practical' },
    ],
    aquarius: [
        { ar: 'مستقل', en: 'Independent' }, { ar: 'مبتكر', en: 'Innovative' }, { ar: 'إنساني', en: 'Humanitarian' },
        { ar: 'غريب الأطوار', en: 'Eccentric' }, { ar: 'فكري', en: 'Intellectual' }, { ar: 'مستقبلي', en: 'Forward-thinking' },
    ],
    pisces: [
        { ar: 'حالم', en: 'Dreamy' }, { ar: 'حسّاس', en: 'Sensitive' }, { ar: 'فنّي', en: 'Artistic' },
        { ar: 'متعاطف', en: 'Compassionate' }, { ar: 'حدسي', en: 'Intuitive' }, { ar: 'رومانسي', en: 'Romantic' },
    ],
};

export function signTraits(id) {
    return ZODIAC_TRAITS[String(id || '').trim().toLowerCase()] || [];
}

const BY_ID = ZODIAC_SIGNS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

export function getSign(id) {
    return BY_ID[String(id || '').trim().toLowerCase()] || null;
}

export function signLabel(id, lang = 'ar') {
    const s = BY_ID[String(id || '').trim().toLowerCase()];
    if (!s) return '';
    return String(lang).startsWith('ar') ? s.ar : s.en;
}

export function isValidSign(id) {
    return Boolean(BY_ID[String(id || '').trim().toLowerCase()]);
}
