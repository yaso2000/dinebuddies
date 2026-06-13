import { normalizeAppLanguage } from './appLanguages.js';

export { normalizeAppLanguage as normalizeAiOutputLanguage, SUPPORTED_APP_LANGUAGE_CODES as SUPPORTED_AI_OUTPUT_LANGUAGES } from './appLanguages.js';

const AI_LANGUAGE_LABELS = {
    en: 'English',
    ar: 'Arabic (warm Modern Standard / natural spoken fusion)',
    fr: 'French',
    es: 'Spanish',
    ur: 'Urdu',
    hi: 'Hindi',
};

/** System instruction: respond in the user's app language. */
export function buildAiLanguageRule(lang) {
    const code = normalizeAppLanguage(lang);
    const label = AI_LANGUAGE_LABELS[code] || AI_LANGUAGE_LABELS.en;
    return `Write only in natural, engaging ${label}. Output must match the JSON shape described in the user message. Do not mix languages unless the user explicitly asks.`;
}

/**
 * Invitation tone (non-dating) for business or personal accounts.
 * @param {string} [lang]
 * @param {'public' | 'private' | 'date' | undefined} subType
 * @param {'user' | 'business'} accountType
 */
export function buildInvitationToneInstruction(lang, subType, accountType) {
    const code = normalizeAppLanguage(lang);

    if (accountType === 'business') {
        const byLang = {
            en: 'Write a promotional business invitation in English: welcoming, professional, and marketing-oriented. Speak as the venue inviting guests. Weave in businessName, tagline, profileDescription, and activeOffers from context when provided — never invent offers, discounts, or locations not in context.',
            ar: 'اكتب دعوة تجارية ترويجية بالعربية: ترحيبية، احترافية، وتسويقية. تحدث بصفتك المكان الذي يدعو الضيوف. ادمج businessName وtagline وprofileDescription وactiveOffers من السياق عند توفرها — لا تخترع عروضاً أو خصومات أو مواقع غير موجودة في السياق.',
            fr: 'Rédigez une invitation commerciale promotionnelle en français : accueillante, professionnelle et orientée marketing. Parlez en tant qu’établissement qui invite des clients. Intégrez businessName, tagline, profileDescription et activeOffers du contexte — n’inventez pas d’offres, de réductions ou de lieux absents du contexte.',
            es: 'Escribe una invitación comercial promocional en español: acogedora, profesional y orientada al marketing. Habla como el local que invita a los comensales. Integra businessName, tagline, profileDescription y activeOffers del contexto — no inventes ofertas, descuentos ni ubicaciones que no estén en el contexto.',
            ur: 'اردو میں ایک ترویجی کاروباری دعوت لکھیں: خوش آمدید، پیشہ ورانہ اور مارکیٹنگ پر مبنی۔ بطور مقام مہمانوں کو مدعو کریں۔ سیاق و سباق سے businessName، tagline، profileDescription اور activeOffers شامل کریں — سیاق میں نہ ہونے والی پیشکشیں یا جگہیں نہ گھڑیں۔',
            hi: 'हिंदी में एक प्रचारात्मक व्यावसायिक निमंत्रण लिखें: स्वागतपूर्ण, पेशेवर और मार्केटिंग-उन्मुख। स्थान के रूप में मेहमानों को आमंत्रित करें। संदर्भ से businessName, tagline, profileDescription और activeOffers जोड़ें — संदर्भ में न हो तो ऑफ़र या स्थान न बनाएं।',
        };
        let tone = byLang[code] || byLang.en;
        if (subType === 'public') {
            tone +=
                code === 'ar'
                    ? ' دعوة عامة: عنوان جذاب يبرز النشاط؛ الوصف يوضح ما يميز المكان وأي عرض نشط.'
                    : ' Public invitation: catchy title featuring the business; description highlights what makes the venue special and any active offer.';
        } else if (subType === 'private') {
            tone +=
                code === 'ar'
                    ? ' دعوة خاصة: نبرة حصرية VIP مع بقاء احترافية.'
                    : ' Private invitation: exclusive, VIP tone while staying professional.';
        } else if (subType === 'date') {
            tone +=
                code === 'ar'
                    ? ' دعوة موعد: أجواء رومانسية مع لمسة ضيافة راقية.'
                    : ' Date invitation: romantic ambiance with a polished hospitality tone.';
        }
        return tone;
    }

    const personalByLang = {
        en: 'Write a personal social invitation in English: warm, casual, and informal — like a friend inviting friends to meet up at a venue.',
        ar: 'اكتب دعوة اجتماعية شخصية بالعربية: دافئة، عفوية، وغير رسمية — كأن صديقاً يدعو أصدقاء للقاء في مكان.',
        fr: 'Rédigez une invitation sociale personnelle en français : chaleureuse, décontractée et informelle — comme un ami qui invite des amis à se retrouver.',
        es: 'Escribe una invitación social personal en español: cálida, informal y cercana — como un amigo que invita a otros a quedar.',
        ur: 'اردو میں ذاتی سماجی دعوت لکھیں: گرم، غیر رسمی — جیسے کوئی دوست دوستوں کو ملنے کی دعوت دے۔',
        hi: 'हिंदी में व्यक्तिगत सामाजिक निमंत्रण लिखें: गर्मजोशी भरा, अनौपचारिक — जैसे कोई मित्र दोस्तों को मिलने बुलाए।',
    };
    let tone = personalByLang[code] || personalByLang.en;
    if (subType === 'public') {
        tone +=
            code === 'ar'
                ? ' دعوة عامة: عنوان جذاب (يُسمح باسم المكان من السياق)، دعوة مفتوحة ودية لنوع المكان.'
                : ' Public invitation: catchy title (venue name allowed from context), friendly open invite for the venue type.';
    } else if (subType === 'private') {
        tone +=
            code === 'ar'
                ? ' دعوة خاصة: نبرة شخصية دافئة لأصدقاء مقربين.'
                : ' Private invitation: warm, personal, close-friends tone.';
    }
    return tone;
}
