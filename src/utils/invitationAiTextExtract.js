/** @typedef {Record<string, unknown>} JsonRecord */

export const INVITATION_TITLE_FIELD_KEYS = [
    'title',
    'invitation_title',
    'invitationTitle',
    'headline',
    'subject',
    'عنوان',
    'العنوان',
];

export const INVITATION_DESCRIPTION_FIELD_KEYS = [
    'description',
    'message',
    'body',
    'invitation_message',
    'invitationMessage',
    'personal_message',
    'content',
    'note',
    'details',
    'msg',
    'desc',
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
export function coerceInvitationText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

/**
 * Scan JSON text for a string value even when JSON.parse fails (quotes, truncation).
 * @param {string} rawText
 * @param {string} key
 */
export function extractJsonStringValue(rawText, key) {
    if (!rawText || typeof rawText !== 'string' || !key) return '';

    const keyPattern = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`, 'i');
    const keyMatch = keyPattern.exec(rawText);
    if (!keyMatch) return '';

    let i = keyMatch.index + keyMatch[0].length;
    while (i < rawText.length && /\s/.test(rawText[i])) i += 1;
    if (rawText[i] !== '"') return '';

    i += 1;
    /** @type {string[]} */
    const parts = [];
    while (i < rawText.length) {
        const ch = rawText[i];
        if (ch === '\\' && i + 1 < rawText.length) {
            const next = rawText[i + 1];
            if (next === 'n') {
                parts.push('\n');
                i += 2;
                continue;
            }
            if (next === 'r') {
                parts.push('\r');
                i += 2;
                continue;
            }
            if (next === 't') {
                parts.push('\t');
                i += 2;
                continue;
            }
            if (next === '"') {
                parts.push('"');
                i += 2;
                continue;
            }
            if (next === '\\') {
                parts.push('\\');
                i += 2;
                continue;
            }
            parts.push(next);
            i += 2;
            continue;
        }
        if (ch === '"') break;
        parts.push(ch);
        i += 1;
    }

    return parts.join('').trim();
}

/**
 * @param {JsonRecord} record
 * @param {string[]} keys
 */
export function pickInvitationField(record, keys) {
    if (!record || typeof record !== 'object') return '';
    for (const key of keys) {
        const direct = coerceInvitationText(record[key]);
        if (direct) return direct;
        const lowerKey = key.toLowerCase();
        for (const [k, v] of Object.entries(record)) {
            if (k.toLowerCase() === lowerKey) {
                const match = coerceInvitationText(v);
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
export function deepPickInvitationField(value, keys, depth = 0, seen = new WeakSet()) {
    if (depth > 6 || value == null) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return deepPickInvitationField(JSON.parse(trimmed), keys, depth + 1, seen);
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
            const found = deepPickInvitationField(item, keys, depth + 1, seen);
            if (found) return found;
        }
        return '';
    }

    const record = /** @type {JsonRecord} */ (value);
    const direct = pickInvitationField(record, keys);
    if (direct) return direct;

    for (const nestedKey of ['data', 'content', 'result', 'response', 'output', 'invitation']) {
        if (nestedKey in record) {
            const found = deepPickInvitationField(record[nestedKey], keys, depth + 1, seen);
            if (found) return found;
        }
    }

    for (const child of Object.values(record)) {
        const found = deepPickInvitationField(child, keys, depth + 1, seen);
        if (found) return found;
    }

    return '';
}

/**
 * @param {string} rawText
 */
export function extractInvitationFieldsFromRaw(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return { title: '', description: '' };
    }

    const body = rawText
        .replace(/```(?:json|javascript|js)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();

    let title = '';
    for (const key of INVITATION_TITLE_FIELD_KEYS) {
        title = extractJsonStringValue(body, key);
        if (title) break;
    }

    let description = '';
    for (const key of INVITATION_DESCRIPTION_FIELD_KEYS) {
        const candidate = extractJsonStringValue(body, key);
        if (candidate && candidate.toLowerCase() !== title.toLowerCase()) {
            description = candidate;
            break;
        }
    }

    return { title, description };
}

/**
 * When the model uses an unexpected key, pick the longest non-title string in the tree.
 * @param {unknown} value
 * @param {string} title
 * @param {number} depth
 */
export function harvestSupplementalInvitationMessage(value, title = '', depth = 0) {
    if (depth > 6 || value == null) return '';
    const titleNorm = title.trim().toLowerCase();
    /** @type {string} */
    let best = '';

    const consider = (candidate) => {
        const s = coerceInvitationText(candidate);
        if (!s) return;
        if (titleNorm && s.toLowerCase() === titleNorm) return;
        if (s.length > best.length) best = s;
    };

    if (typeof value === 'string') {
        consider(value);
        return best;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = harvestSupplementalInvitationMessage(item, title, depth + 1);
            if (found.length > best.length) best = found;
        }
        return best;
    }

    if (typeof value !== 'object') return best;

    for (const [k, v] of Object.entries(value)) {
        if (INVITATION_TITLE_FIELD_KEYS.some((key) => key.toLowerCase() === k.toLowerCase())) {
            continue;
        }
        if (typeof v === 'string') {
            consider(v);
            continue;
        }
        const nested = harvestSupplementalInvitationMessage(v, title, depth + 1);
        if (nested.length > best.length) best = nested;
    }

    return best;
}

/**
 * Merge parsed JSON + raw Gemini text into stable { title, description }.
 * @param {unknown} parsed
 * @param {string} [rawText]
 */
export function coalesceInvitationAiText(parsed, rawText = '') {
    const record =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? /** @type {JsonRecord} */ ({ ...parsed })
            : /** @type {JsonRecord} */ ({});

    let title =
        pickInvitationField(record, INVITATION_TITLE_FIELD_KEYS) ||
        deepPickInvitationField(record, INVITATION_TITLE_FIELD_KEYS);
    let description =
        pickInvitationField(record, INVITATION_DESCRIPTION_FIELD_KEYS) ||
        deepPickInvitationField(record, INVITATION_DESCRIPTION_FIELD_KEYS);

    if (rawText) {
        const fromRaw = extractInvitationFieldsFromRaw(rawText);
        if (!title && fromRaw.title) title = fromRaw.title;
        if (!description && fromRaw.description) description = fromRaw.description;
    }

    if (title && !description) {
        const harvested = harvestSupplementalInvitationMessage(record, title);
        if (harvested) description = harvested;
    }

    if (!title && description.includes('\n')) {
        const [firstLine, ...rest] = description.split('\n');
        if (firstLine.trim() && rest.join('\n').trim()) {
            title = firstLine.trim();
            description = rest.join('\n').trim();
        }
    }

    if (title && !description && rawText) {
        for (const key of INVITATION_DESCRIPTION_FIELD_KEYS) {
            const candidate = extractJsonStringValue(rawText, key);
            if (candidate && candidate.toLowerCase() !== title.toLowerCase()) {
                description = candidate;
                break;
            }
        }
    }

    /** @type {JsonRecord} */
    const result = { ...record };
    if (title) result.title = title;
    if (description) result.description = description;
    return result;
}
