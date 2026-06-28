/** @typedef {'arch_luxury' | 'vintage_ticket' | 'modern_minimal'} CardStructure */

export const CARD_STRUCTURES = /** @type {const} */ (['arch_luxury', 'vintage_ticket', 'modern_minimal']);

export const DEFAULT_CARD_STRUCTURE = /** @type {CardStructure} */ ('modern_minimal');

/** Dating / invitation template id → visual structure for AI + overlay safe zones */
export const DATING_BACKGROUND_TO_CARD_STRUCTURE = {
    'private-luxury-floral': 'arch_luxury',
    'private-heart-roses': 'arch_luxury',
    'private-candle-room': 'arch_luxury',
    'private-candlelight-table': 'arch_luxury',
    'private-rooftop-dinner': 'arch_luxury',
    'private-rose-pathway': 'arch_luxury',
    'private-mystery-entrance': 'vintage_ticket',
    'private-rainy-coffee': 'vintage_ticket',
    'private-sunset-beach': 'vintage_ticket',
    'private-restaurant-chemistry': 'modern_minimal',
    'private-midnight-city-lights': 'modern_minimal',
    'private-neon-coffee-date': 'modern_minimal',
    'private-neon-hearts-date': 'modern_minimal',
    'private-golden-love-night': 'arch_luxury',
    'private-love-in-bloom': 'arch_luxury',
    'private-romantic-coffee-escape': 'vintage_ticket',
    'private-roses-candlelight': 'arch_luxury',
    'private-secret-garden-date': 'arch_luxury',
    'private-sunset-romance': 'vintage_ticket',
    'private-sunset-walk-together': 'vintage_ticket',
    'private-sweetheart-rooftop': 'arch_luxury',
    'private-valentines-evening': 'arch_luxury',
    'private-velvet-lounge-evening': 'arch_luxury',
    'private-rose': 'arch_luxury',
    'private-city': 'modern_minimal',
    'private-minimal': 'modern_minimal',
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
    let mapped = DATING_BACKGROUND_TO_CARD_STRUCTURE[backgroundId];
    if (!mapped && backgroundId.startsWith('private-friend-')) {
        mapped = DATING_BACKGROUND_TO_CARD_STRUCTURE[`private-${backgroundId.slice('private-friend-'.length)}`];
    }
    if (!mapped && backgroundId.startsWith('private-social-')) {
        mapped = DATING_BACKGROUND_TO_CARD_STRUCTURE[`private-${backgroundId.slice('private-social-'.length)}`];
    }
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
            return 'social-invitation-card-preview--structure-arch-luxury';
        case 'vintage_ticket':
            return 'social-invitation-card-preview--structure-vintage-ticket';
        case 'modern_minimal':
        default:
            return 'social-invitation-card-preview--structure-modern-minimal';
    }
}
