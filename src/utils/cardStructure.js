/** @typedef {'arch_luxury' | 'vintage_ticket' | 'modern_minimal'} CardStructure */

export const CARD_STRUCTURES = /** @type {const} */ (['arch_luxury', 'vintage_ticket', 'modern_minimal']);

export const DEFAULT_CARD_STRUCTURE = /** @type {CardStructure} */ ('modern_minimal');

/** Dating / invitation template id → visual structure for AI + overlay safe zones */
export const DATING_BACKGROUND_TO_CARD_STRUCTURE = {
    'dating-luxury-floral': 'arch_luxury',
    'dating-heart-roses': 'arch_luxury',
    'dating-candle-room': 'arch_luxury',
    'dating-candlelight-table': 'arch_luxury',
    'dating-rooftop-dinner': 'arch_luxury',
    'dating-rose-pathway': 'arch_luxury',
    'dating-mystery-entrance': 'vintage_ticket',
    'dating-rainy-coffee': 'vintage_ticket',
    'dating-sunset-beach': 'vintage_ticket',
    'dating-restaurant-chemistry': 'modern_minimal',
    'dating-rose': 'arch_luxury',
    'dating-city': 'modern_minimal',
    'dating-minimal': 'modern_minimal',
};

/**
 * @param {unknown} value
 * @returns {CardStructure}
 */
export function normalizeCardStructure(value) {
    const raw = String(value || '').trim();
    if (CARD_STRUCTURES.includes(/** @type {CardStructure} */ (raw))) {
        return /** @type {CardStructure} */ (raw);
    }
    return DEFAULT_CARD_STRUCTURE;
}

/**
 * @param {string | null | undefined} backgroundId
 * @param {CardStructure} [fallback]
 */
export function resolveCardStructureFromBackgroundId(backgroundId, fallback = DEFAULT_CARD_STRUCTURE) {
    if (!backgroundId) return fallback;
    const mapped = DATING_BACKGROUND_TO_CARD_STRUCTURE[backgroundId];
    return mapped ? normalizeCardStructure(mapped) : fallback;
}

/**
 * @param {CardStructure} structure
 */
export function getCardStructureConstraints(structure) {
    switch (normalizeCardStructure(structure)) {
        case 'arch_luxury':
            return { titleMaxWords: 5, descriptionMaxWords: 25 };
        case 'vintage_ticket':
            return { titleMaxWords: 4, descriptionMaxWords: 20 };
        case 'modern_minimal':
        default:
            return { titleMaxWords: 8, descriptionMaxWords: 50 };
    }
}

/**
 * @param {string} text
 * @param {number} maxWords
 */
export function limitWords(text, maxWords) {
    const trimmed = String(text || '').trim();
    if (!trimmed || !Number.isFinite(maxWords) || maxWords <= 0) return trimmed;
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return trimmed;
    return words.slice(0, maxWords).join(' ');
}

/**
 * @param {CardStructure} structure
 * @param {string} title
 * @param {string} description
 */
export function enforceCardStructureTextLimits(structure, title, description) {
    const limits = getCardStructureConstraints(structure);
    return {
        title: limitWords(title, limits.titleMaxWords),
        description: limitWords(description, limits.descriptionMaxWords),
    };
}

/**
 * Arabic system-prompt block for Gemini (visual safe-zone copy limits).
 * @param {CardStructure} structure
 */
export function buildCardStructurePromptBlock(structure) {
    switch (normalizeCardStructure(structure)) {
        case 'arch_luxury':
            return `
=== قيود بصرية حاسمة (قالب القوس الفاخر arch_luxury) ===
- نبرة النص: بالغة الفخامة، راقية، دافئة، واحتفالية.
- العنوان: يجب ألا يتجاوز 5 كلمات كحد أقصى (ليناسب قوس الورد والذهب العلوي).
- الرسالة/الوصف: يجب ألا يتجاوز 25 كلمة كحد أقصى (ليتجنب التداخل مع الكعك والشموع والهدايا في الأسفل).
- قواعد الكتابة: كلمات منتقاة بعناية شديدة تفيض بالود والترحاب.`;
        case 'vintage_ticket':
            return `
=== قيود بصرية حاسمة (قالب التذكرة الكلاسيكية vintage_ticket) ===
- نبرة النص: حيوية، ممتعة، تبدو كبطاقة دخول حصرية لكبار الشخصيات (VIP Pass).
- العنوان: يجب ألا يتجاوز 4 كلمات كحد أقصى (يكتب كاسم حدث رئيسي).
- الرسالة/الوصف: يجب ألا يتجاوز 20 كلمة كحد أقصى. استخدم مصطلحات مثل «تذكرة مقبولة لشخص واحد»، «دخول حصري لغلق الطاولة»، «أبرز تذكرتك عند الحضور».`;
        case 'modern_minimal':
        default:
            return `
=== قيود بصرية حاسمة (قالب البسيط العصري modern_minimal) ===
- نبرة النص: معاصرة، مريحة، جمالية، ومنفتحة.
- العنوان: مرن (حتى 8 كلمات).
- الرسالة/الوصف: مرن (حتى 50 كلمة). يمكنك الكتابة بأسلوب شاعري، هادئ أو وصفي منسق.`;
    }
}

/**
 * CSS class names for overlay safe zones (used by CardTextOverlay).
 * @param {CardStructure} structure
 */
export function getCardTextOverlayLayoutClass(structure) {
    switch (normalizeCardStructure(structure)) {
        case 'arch_luxury':
            return 'card-text-overlay card-text-overlay--arch-luxury';
        case 'vintage_ticket':
            return 'card-text-overlay card-text-overlay--vintage-ticket';
        case 'modern_minimal':
        default:
            return 'card-text-overlay card-text-overlay--modern-minimal';
    }
}

/** Preview card root modifier — same safe zones, unified with theme/font stack */
export function getCardPreviewStructureClass(structure) {
    switch (normalizeCardStructure(structure)) {
        case 'arch_luxury':
            return 'private-invitation-card-preview--structure-arch-luxury';
        case 'vintage_ticket':
            return 'private-invitation-card-preview--structure-vintage-ticket';
        case 'modern_minimal':
        default:
            return 'private-invitation-card-preview--structure-modern-minimal';
    }
}
