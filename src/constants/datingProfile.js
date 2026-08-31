/**
 * Dating profile (isolated dating space). Privacy-conservative: no exact age —
 * only an age CATEGORY — and a nickname instead of a real name.
 */
export const DATING_AGE_CATEGORIES = [
    { id: '18-24', label: '18–24' },
    { id: '25-34', label: '25–34' },
    { id: '35-44', label: '35–44' },
    { id: '45-54', label: '45–54' },
    { id: '55+', label: '55+' },
];

export const DATING_AGE_CATEGORY_IDS = DATING_AGE_CATEGORIES.map((c) => c.id);

export const DATING_GENDERS = [
    { id: 'female', symbol: '♀', labelKey: 'match_female', defaultLabel: 'Female' },
    { id: 'male', symbol: '♂', labelKey: 'match_male', defaultLabel: 'Male' },
];

export const DATING_GENDER_IDS = DATING_GENDERS.map((g) => g.id);

export const DATING_LOOKING_FOR = [
    { id: 'female', symbol: '♀', labelKey: 'match_female', defaultLabel: 'Female' },
    { id: 'male', symbol: '♂', labelKey: 'match_male', defaultLabel: 'Male' },
    { id: 'any', symbol: '★', labelKey: 'match_any', defaultLabel: 'Anyone' },
];

export const DATING_NICKNAME_MAX = 24;
export const DATING_NICKNAME_MIN = 2;
