/**
 * Public invitation headline suggestions: normalize AI output and provide category fallbacks.
 * Max 7 words per line; UI always receives up to 10 strings.
 */

const MAX_WORDS = 7;
const TARGET_COUNT = 10;

/** Category pools (exactly 10 unique lines across all buckets). */
const POOLS = {
    dining: ['Dinner Together Tonight', 'Join Me For Lunch', 'Food Lovers Meetup'],
    cafe: ['Coffee & Good Talk', 'Cafe Friends Wanted'],
    social: ['Meet New People Today', "Let's Hang Out"],
    gaming: ['Gaming Squad Tonight'],
    general: ['Join My Invitation', 'Fun Plans Ahead'],
};

function countWords(s) {
    return String(s || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

export function trimHeadlineToMaxWords(line, maxWords = MAX_WORDS) {
    const parts = String(line || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return parts.slice(0, maxWords).join(' ');
}

function looksLikeTechnicalOrErrorString(s) {
    const t = String(s || '').trim();
    if (!t) return true;
    if (t.length > 200) return true;
    const lower = t.toLowerCase();
    return (
        /^(error|warning)\b/i.test(t) ||
        /\b(failed|failure|exception|stack trace|status\s*:\s*\d{3}|bad gateway|internal server|cloud function|openai|firebase|functions\/)/i.test(
            lower
        ) ||
        /the ai suggestion service/i.test(lower)
    );
}

/**
 * Pick category key from invitation form (public flow).
 * @param {object} formData
 */
export function pickHeadlineCategoryKey(formData) {
    const occ = String(formData?.occasionType || '').toLowerCase();
    if (occ.includes('game')) return 'gaming';
    const typ = String(formData?.type || '').toLowerCase();
    if (typ.includes('cafe')) return 'cafe';
    if (typ.includes('restaurant') || typ.includes('food truck') || typ.includes('fast food')) return 'dining';
    if (typ.includes('bar') || typ.includes('night club') || typ.includes('club')) return 'social';
    return 'general';
}

/**
 * 10 ordered fallback headlines; category-first, then other pools, deduped.
 * @param {object} formData
 * @returns {string[]}
 */
export function getFallbackHeadlineSuggestions(formData) {
    const primary = pickHeadlineCategoryKey(formData);
    const order = [primary, 'dining', 'cafe', 'social', 'gaming', 'general'].filter(
        (k, i, a) => a.indexOf(k) === i
    );
    const out = [];
    const seen = new Set();
    for (const key of order) {
        const list = POOLS[key] || POOLS.general;
        for (const line of list) {
            if (out.length >= TARGET_COUNT) break;
            const norm = trimHeadlineToMaxWords(line, MAX_WORDS);
            const lk = norm.toLowerCase();
            if (!norm || seen.has(lk)) continue;
            seen.add(lk);
            out.push(norm);
        }
    }
    return out.slice(0, TARGET_COUNT);
}

/**
 * Extract `suggestions` from httpsCallable result; return only clean string lines.
 * @param {*} result - `{ data }` from callable
 * @returns {string[]}
 */
function extractRawSuggestionsArray(result) {
    if (!result || typeof result !== 'object') return [];
    const data = result.data;
    if (data == null) return [];

    if (Array.isArray(data)) {
        return data;
    }
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.suggestions)) return parsed.suggestions;
        } catch {
            /* ignore */
        }
        return [];
    }
    if (typeof data === 'object') {
        if (Array.isArray(data.suggestions)) return data.suggestions;
        if (data.message != null || data.error != null) return [];
    }
    return [];
}

/**
 * Normalize API output to a list of valid headline strings (max 7 words each).
 * Invalid entries are dropped.
 * @param {*} result - callable `{ data }`
 * @returns {string[]}
 */
export function normalizeHeadlineSuggestionsFromApi(result) {
    const raw = extractRawSuggestionsArray(result);
    if (!Array.isArray(raw)) return [];

    const out = [];
    const seen = new Set();

    for (const item of raw) {
        if (out.length >= TARGET_COUNT) break;
        if (typeof item !== 'string') continue;
        let line = item.replace(/\s+/g, ' ').trim();
        if (!line) continue;
        if (looksLikeTechnicalOrErrorString(line)) continue;
        line = trimHeadlineToMaxWords(line, MAX_WORDS);
        if (countWords(line) < 1) continue;
        const lk = line.toLowerCase();
        if (seen.has(lk)) continue;
        seen.add(lk);
        out.push(line);
    }
    return out;
}

/**
 * Merge AI lines with fallbacks until 10 unique lines.
 * @param {string[]} aiLines
 * @param {object} formData
 * @returns {string[]}
 */
export function padHeadlinesToTen(aiLines, formData) {
    const fb = getFallbackHeadlineSuggestions(formData);
    const out = [];
    const seen = new Set();

    const push = (line) => {
        const t = trimHeadlineToMaxWords(line, MAX_WORDS);
        if (!t || looksLikeTechnicalOrErrorString(t)) return;
        const lk = t.toLowerCase();
        if (seen.has(lk)) return;
        seen.add(lk);
        out.push(t);
    };

    for (const x of aiLines || []) push(x);
    for (const x of fb) {
        if (out.length >= TARGET_COUNT) break;
        push(x);
    }
    let i = 0;
    while (out.length < TARGET_COUNT && fb.length > 0) {
        push(`${fb[i % fb.length]} ${out.length + 1}`);
        i += 1;
        if (i > 50) break;
    }
    return out.slice(0, TARGET_COUNT);
}
