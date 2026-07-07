import { RELATIONSHIP_ADVICE_KNOWLEDGE } from '../constants/relationshipAdviceKnowledge.js';

const ARABIC_RE = /[\u0600-\u06FF]/;
const TOKEN_SPLIT_RE = /[^\p{L}\p{N}]+/u;

/** @param {string} text */
function normalizeForMatch(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFKC')
        .trim();
}

/** @param {string} text */
function tokenize(text) {
    const normalized = normalizeForMatch(text);
    if (!normalized) return [];

    return normalized
        .split(TOKEN_SPLIT_RE)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
}

/** @param {string} haystack @param {string} needle */
function containsPhrase(haystack, needle) {
    const h = normalizeForMatch(haystack);
    const n = normalizeForMatch(needle);
    if (!h || !n) return false;
    return h.includes(n);
}

/**
 * @param {string} query
 * @param {import('../constants/relationshipAdviceKnowledge.js').RelationshipAdviceEntry} entry
 * @param {string} langPrefix 'ar' | 'en'
 */
function scoreEntry(query, entry, langPrefix) {
    const qTokens = new Set(tokenize(query));
    if (qTokens.size === 0) return 0;

    let score = 0;
    const lang = langPrefix === 'ar' ? 'ar' : 'en';
    const otherLang = lang === 'ar' ? 'en' : 'ar';

    for (const kw of [...entry.keywords[lang], ...entry.keywords[otherLang]]) {
        const kwNorm = normalizeForMatch(kw);
        if (!kwNorm) continue;

        if (containsPhrase(query, kwNorm)) {
            score += kwNorm.split(/\s+/).length > 1 ? 6 : 4;
            continue;
        }

        for (const token of tokenize(kw)) {
            if (qTokens.has(token)) score += 2;
        }
    }

    for (const example of [...entry.questionExamples[lang], ...entry.questionExamples[otherLang]]) {
        if (containsPhrase(query, example)) {
            score += 10;
            continue;
        }

        let overlap = 0;
        for (const token of tokenize(example)) {
            if (qTokens.has(token)) overlap += 1;
        }
        if (overlap >= 2) score += overlap * 2;
    }

    if (containsPhrase(query, entry.topic)) {
        score += 3;
    }

    return score;
}

/**
 * @param {string} query
 * @param {string} [outputLanguage]
 * @param {{ limit?: number, minScore?: number }} [opts]
 * @returns {import('../constants/relationshipAdviceKnowledge.js').RelationshipAdviceEntry[]}
 */
export function retrieveRelationshipAdvice(query, outputLanguage = 'en', opts = {}) {
    const limit = opts.limit ?? 3;
    const minScore = opts.minScore ?? 4;
    const trimmed = String(query || '').trim();
    if (!trimmed) return [];

    const langPrefix = ARABIC_RE.test(trimmed) || outputLanguage === 'ar' ? 'ar' : 'en';

    const ranked = RELATIONSHIP_ADVICE_KNOWLEDGE.map((entry) => ({
        entry,
        score: scoreEntry(trimmed, entry, langPrefix),
    }))
        .filter((row) => row.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return ranked.map((row) => row.entry);
}

/**
 * @param {import('../constants/relationshipAdviceKnowledge.js').RelationshipAdviceEntry[]} entries
 */
export function formatAdviceExcerptsForPrompt(entries) {
    if (!entries.length) return '';

    const blocks = entries.map((entry, index) => {
        const sourceLine = entry.sources.map((s) => `${s.name} (${s.url})`).join('; ');
        return [
            `[${index + 1}] Topic: ${entry.topic}`,
            `Guidance: ${entry.guidance}`,
            `Sources: ${sourceLine}`,
        ].join('\n');
    });

    return [
        '--- Curated relationship advice excerpts (search results — use as primary grounding) ---',
        ...blocks,
        '--- End excerpts ---',
    ].join('\n');
}
