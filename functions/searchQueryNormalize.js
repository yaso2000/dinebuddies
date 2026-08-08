/** Same rules as src/utils/searchQueryNormalize.js (keep in sync). */
function normalizeSearchQuery(raw) {
    if (raw == null) return '';
    let s = String(raw).normalize('NFC').trim().toLowerCase();
    if (!s) return '';

    s = s.replace(/[\u200b-\u200f\u061c\u2066-\u2069\ufeff\ufe00-\ufe0f]/g, '');
    s = s.replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '');
    s = s.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
    s = s.replace(/\u0649/g, '\u064a');
    s = s.replace(/\u06cc/g, '\u064a');
    s = s.replace(/\u0640/g, '');
    s = s.replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff00 + 0x20));

    return s.slice(0, 80);
}

module.exports = { normalizeSearchQuery };
