import {
    coalesceInvitationAiText,
    extractInvitationFieldsFromRaw,
} from './invitationAiTextExtract.js';
import { enforceCardStructureTextLimits, normalizeCardStructure } from './cardStructure.js';
import { normalizeStudioTextAnimation } from '../features/motion-post/studio/studioTextAnimation';

/** Map Gemini animation_type → Smart Post Studio rail id. */
export function mapAiAnimationToStudio(animationType) {
    const map = {
        'slide-up': 'slide',
        'fade-in': 'fade',
        'zoom-in': 'zoom',
    };
    return normalizeStudioTextAnimation(map[String(animationType || '').trim()] || 'slide');
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string | null}
 */
export function extractAIImageUrl(data) {
    if (!data || typeof data !== 'object') return null;
    const image = data.image;
    if (typeof image === 'string' && image.trim()) return image.trim();
    if (image && typeof image === 'object') {
        const record = /** @type {Record<string, unknown>} */ (image);
        const nested =
            record.mediaLibraryItem &&
            typeof record.mediaLibraryItem === 'object' &&
            /** @type {Record<string, unknown>} */ (record.mediaLibraryItem).url;
        if (typeof nested === 'string' && nested.trim()) return nested.trim();
        if (typeof record.url === 'string' && record.url.trim()) return record.url.trim();
    }
    return null;
}

const TITLE_KEYS = [
    'title',
    'invitation_title',
    'invitationTitle',
    'headline',
    'subject',
    'عنوان',
    'العنوان',
];
const DESCRIPTION_KEYS = [
    'description',
    'message',
    'body',
    'invitation_message',
    'invitationMessage',
    'text',
    'وصف',
    'رسالة',
    'الرسالة',
    'الوصف',
];

/**
 * @param {unknown} value
 * @returns {string}
 */
function coerceAiString(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

/**
 * @param {Record<string, unknown>} record
 * @param {string[]} keys
 */
function pickStringField(record, keys) {
    for (const key of keys) {
        const direct = coerceAiString(record[key]);
        if (direct) return direct;
        const lowerKey = key.toLowerCase();
        for (const [k, v] of Object.entries(record)) {
            if (k.toLowerCase() === lowerKey) {
                const match = coerceAiString(v);
                if (match) return match;
            }
        }
    }
    return '';
}

/**
 * @param {unknown} value
 * @param {string[]} keys
 * @param {number} depth
 * @param {WeakSet<object>} seen
 */
function deepPickString(value, keys, depth = 0, seen = new WeakSet()) {
    if (depth > 6 || value == null) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return deepPickString(JSON.parse(trimmed), keys, depth + 1, seen);
            } catch {
                return '';
            }
        }
        return '';
    }
    if (typeof value !== 'object') return '';
    if (seen.has(value)) return '';
    seen.add(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = deepPickString(item, keys, depth + 1, seen);
            if (found) return found;
        }
        return '';
    }

    const record = /** @type {Record<string, unknown>} */ (value);
    const direct = pickStringField(record, keys);
    if (direct) return direct;

    for (const nestedKey of ['data', 'content', 'result', 'response', 'output', 'invitation']) {
        if (nestedKey in record) {
            const found = deepPickString(record[nestedKey], keys, depth + 1, seen);
            if (found) return found;
        }
    }

    for (const child of Object.values(record)) {
        const found = deepPickString(child, keys, depth + 1, seen);
        if (found) return found;
    }

    return '';
}

/**
 * Unwrap nested `{ success, data }` envelopes from API payloads.
 * @param {unknown} value
 */
export function unwrapAiResponseData(value) {
    let current = value;
    for (let i = 0; i < 4; i += 1) {
        if (typeof current === 'string') {
            const trimmed = current.trim();
            if (!trimmed) return current;
            try {
                current = JSON.parse(trimmed);
                continue;
            } catch {
                return current;
            }
        }
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            return current;
        }
        const record = /** @type {Record<string, unknown>} */ (current);
        if (record.success === true && record.data != null) {
            current = record.data;
            continue;
        }
        return current;
    }
    return current;
}

/**
 * Normalize invitation AI payloads (English or Arabic JSON keys, nested shapes).
 * @param {unknown} data
 * @param {string} [rawText] Optional raw Gemini JSON for fallback extraction
 */
export function normalizeInvitationAiData(data, rawText = '') {
    const unwrapped = unwrapAiResponseData(data);
    const rawFallback =
        rawText ||
        (typeof data === 'string' ? data : '') ||
        (typeof unwrapped === 'string' ? unwrapped : '');

    if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) {
        if (rawFallback) {
            const fromRaw = extractInvitationFieldsFromRaw(rawFallback);
            return {
                ...(fromRaw.title ? { title: fromRaw.title } : {}),
                ...(fromRaw.description ? { description: fromRaw.description } : {}),
            };
        }
        return {};
    }

    const coalesced = coalesceInvitationAiText(unwrapped, rawFallback);
    return {
        ...(coalesceInvitationTextField(coalesced.title) ? { title: coerceInvitationText(coalesced.title) } : {}),
        ...(coalesceInvitationTextField(coalesced.description)
            ? { description: coerceInvitationText(coalesced.description) }
            : {}),
    };
}

/** @param {unknown} value */
function coalesceInvitationTextField(value) {
    return coerceInvitationText(value).length > 0;
}

/** @param {unknown} value @returns {string} */
function coerceInvitationText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

/**
 * @param {'invitation' | 'regular_post' | 'featured_post' | 'animated_post'} postType
 * @param {unknown} data
 * @returns {{ title?: string, description?: string, text?: string, animation_type?: string }}
 */
export function extractAIContentFields(postType, data) {
    if (!data || typeof data !== 'object') return {};

    switch (postType) {
        case 'invitation': {
            const normalized = normalizeInvitationAiData(data);
            const title = typeof normalized.title === 'string' ? normalized.title.trim() : '';
            const description =
                typeof normalized.description === 'string' ? normalized.description.trim() : '';
            return {
                title,
                description,
            };
        }

        case 'regular_post': {
            const record = /** @type {Record<string, unknown>} */ (unwrapAiResponseData(data) || {});
            return {
                title: typeof record.title === 'string' ? record.title.trim() : '',
                text: typeof record.text === 'string' ? record.text.trim() : '',
            };
        }

        case 'featured_post': {
            const record = /** @type {Record<string, unknown>} */ (unwrapAiResponseData(data) || {});
            return {
                title: typeof record.title === 'string' ? record.title.trim() : '',
                description: typeof record.description === 'string' ? record.description.trim() : '',
            };
        }

        case 'animated_post': {
            const record = /** @type {Record<string, unknown>} */ (unwrapAiResponseData(data) || {});
            return {
                title: typeof record.title === 'string' ? record.title.trim() : '',
                description: typeof record.description === 'string' ? record.description.trim() : '',
                animation_type:
                    typeof record.animation_type === 'string' ? record.animation_type.trim() : '',
            };
        }

        default:
            return {};
    }
}

/**
 * @param {unknown} data
 * @param {{ titleMax?: number, descriptionMax?: number, cardStructure?: string }} [limits]
 */
export function applyInvitationAiFields(data, limits = {}) {
    const titleMax = limits.titleMax ?? 120;
    const descriptionMax = limits.descriptionMax ?? 5000;
    const fields = extractAIContentFields('invitation', data);
    let title = fields.title ? fields.title.slice(0, titleMax) : '';
    let description = fields.description
        ? fields.description.slice(0, descriptionMax)
        : '';

    if (limits.cardStructure) {
        const limited = enforceCardStructureTextLimits(
            normalizeCardStructure(limits.cardStructure),
            title,
            description
        );
        title = limited.title.slice(0, titleMax);
        description = limited.description.slice(0, descriptionMax);
    }
    return {
        title,
        description,
        hasTitle: Boolean(title),
        hasDescription: Boolean(description),
        hasContent: Boolean(title || description),
    };
}
