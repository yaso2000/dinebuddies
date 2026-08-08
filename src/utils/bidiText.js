/**
 * Mixed Arabic / Latin display: fixed direction from app language + isolate embedded runs.
 * Fixes reversed word order when e.g. "KFC" or "Bundaberg" appear inside Arabic copy.
 */

const LRI = '\u2066'; // Left-to-right isolate
const RLI = '\u2067'; // Right-to-left isolate
const PDI = '\u2069'; // Pop directional isolate

const ARABIC_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_LETTER_RE = /[A-Za-z]/;

/** Latin words, brands, numbers, and common punctuation in embedded English. */
const LATIN_RUN_RE = /[A-Za-z0-9](?:[A-Za-z0-9\s.,'’'&@#%/\-–—:]*[A-Za-z0-9])?|[A-Za-z0-9]+/g;

const ARABIC_RUN_RE =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*/g;

/**
 * @param {string | undefined} language i18n language code
 * @returns {'rtl' | 'ltr'}
 */
export function getAppTextDirection(language) {
    const lang = String(language || '').toLowerCase();
    if (lang.startsWith('ar') || lang.startsWith('he') || lang.startsWith('fa') || lang.startsWith('ur')) {
        return 'rtl';
    }
    return 'ltr';
}

/**
 * @param {string | undefined} language
 * @returns {string | undefined} BCP 47 for lang attribute
 */
export function getAppTextLang(language) {
    const lang = String(language || '').toLowerCase();
    if (lang.startsWith('ar')) return 'ar';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('he')) return 'he';
    if (lang.startsWith('fa')) return 'fa';
    if (lang.startsWith('ur')) return 'ur';
    return undefined;
}

/**
 * @param {string} text
 */
export function hasArabicScript(text) {
    return ARABIC_CHAR_RE.test(String(text || ''));
}

/**
 * @param {string} text
 */
export function hasLatinScript(text) {
    return LATIN_LETTER_RE.test(String(text || ''));
}

/**
 * Wrap opposite-script runs so they keep correct order inside a paragraph.
 * @param {string} text
 * @param {'rtl' | 'ltr'} primaryDir
 */
export function isolateOppositeScriptRuns(text, primaryDir) {
    const raw = String(text || '');
    if (!raw) return raw;

    if (primaryDir === 'rtl') {
        return raw.replace(LATIN_RUN_RE, (match) => {
            if (!match.trim()) return match;
            return `${LRI}${match}${PDI}`;
        });
    }

    return raw.replace(ARABIC_RUN_RE, (match) => `${RLI}${match}${PDI}`);
}

/**
 * Prepare user-facing copy: one paragraph + direction from app language.
 * @param {string} text
 * @param {string | undefined} language i18n.language
 * @returns {{ text: string, dir: 'rtl' | 'ltr', lang: string | undefined }}
 */
export function prepareBidiDisplayText(text, language) {
    const primaryDir = getAppTextDirection(language);
    const lang = getAppTextLang(language);
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) {
        return { text: '', dir: primaryDir, lang };
    }

    const arabic = hasArabicScript(normalized);
    const latin = hasLatinScript(normalized);

    if (primaryDir === 'rtl') {
        if (latin && !arabic) {
            return { text: normalized, dir: 'ltr', lang: lang || 'en' };
        }
        if (latin && arabic) {
            return { text: isolateOppositeScriptRuns(normalized, 'rtl'), dir: 'rtl', lang: lang || 'ar' };
        }
        return { text: normalized, dir: 'rtl', lang: lang || 'ar' };
    }

    if (arabic && !latin) {
        return { text: normalized, dir: 'rtl', lang: lang || 'ar' };
    }
    if (arabic && latin) {
        return { text: isolateOppositeScriptRuns(normalized, 'ltr'), dir: 'ltr', lang: lang || 'en' };
    }
    return { text: normalized, dir: 'ltr', lang: lang || 'en' };
}

/**
 * Props for inputs / textareas (no isolate characters in stored value).
 * @param {string | undefined} language
 */
export function getAppBidiFieldProps(language) {
    const dir = getAppTextDirection(language);
    const lang = getAppTextLang(language);
    return {
        dir,
        lang,
        style: { direction: dir, textAlign: dir === 'rtl' ? 'right' : 'left' },
    };
}
