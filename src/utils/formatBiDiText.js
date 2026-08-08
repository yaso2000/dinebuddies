/** Unicode Right-to-Left Mark — anchors trailing neutral chars to the Arabic run. */
export const RLM = '\u200F';

/** Arabic + extended Arabic script blocks (includes Persian/Urdu in Arabic script). */
const ARABIC_SCRIPT_RE =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Trailing punctuation that commonly jumps in mixed BiDi paragraphs. */
const TRAILING_PUNCT_RE = /[!?.,;:…。،؟！。、]+$/;

/**
 * Returns true when the string contains Arabic-script characters.
 * @param {unknown} value
 */
export function containsArabicScript(value) {
    if (value == null || value === '') return false;
    return ARABIC_SCRIPT_RE.test(String(value));
}

/**
 * Appends RLM when Arabic text ends with neutral punctuation so marks stay with the word.
 * Safe for read-only labels; do NOT use on controlled input values (cursor jump).
 * @param {unknown} value
 * @returns {string}
 */
export function formatBiDiText(value) {
    if (value == null || value === '') return '';
    const str = String(value);
    if (!containsArabicScript(str)) return str;
    if (!TRAILING_PUNCT_RE.test(str)) return str;
    if (str.endsWith(RLM)) return str;
    return `${str}${RLM}`;
}

/** Escape HTML for safe insertion into template strings. */
export function escapeHtmlText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const BIDI_INLINE_STYLE = 'unicode-bidi:isolate;text-align:start';

/**
 * BiDi-safe inline HTML snippet for map popups / innerHTML (not React).
 * @param {unknown} value
 */
export function htmlBiDiText(value) {
    const text = escapeHtmlText(formatBiDiText(value));
    return `<span dir="auto" style="${BIDI_INLINE_STYLE}">${text}</span>`;
}

/**
 * Wrap arbitrary HTML block with auto direction (popup shells).
 * @param {string} innerHtml
 */
export function htmlBiDiBlock(innerHtml) {
    return `<div dir="auto" style="${BIDI_INLINE_STYLE}">${innerHtml}</div>`;
}

/**
 * Recursively format string/number children for read-only text nodes.
 * React elements and arrays are preserved; only plain text runs are transformed.
 * @param {import('react').ReactNode} children
 * @param {boolean} enabled
 * @returns {import('react').ReactNode}
 */
export function formatBiDiChildren(children, enabled = true) {
    if (!enabled) return children;
    if (children == null || typeof children === 'boolean') return children;
    if (typeof children === 'string' || typeof children === 'number') {
        return formatBiDiText(children);
    }
    if (Array.isArray(children)) {
        return children.map((child, index) => formatBiDiChildren(child, enabled));
    }
    return children;
}
