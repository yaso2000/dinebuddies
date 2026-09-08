/**
 * Text normalization for lenient, non-literal search (Arabic + Latin).
 *
 * Folds away the differences that trip up literal matching:
 *  - lowercase
 *  - strip Arabic diacritics (tashkeel) and tatweel
 *  - unify hamza/alef forms (أ إ آ ء ٱ → ا, ؤ → و, ئ → ي)
 *  - alef-maqsura ى → ي, ta-marbuta ة → ه
 *  - collapse whitespace
 * so "المنصورة" ≈ "المنصوره" ≈ "المنصوره" and "أحمد" ≈ "احمد".
 */
export function normalizeSearchText(input) {
  let s = String(input == null ? '' : input).toLowerCase();
  // Remove Arabic diacritics (fatha..sukun), superscript alef, and tatweel.
  s = s.replace(/[ً-ْٰـ]/g, '');
  // Unify alef/hamza variants.
  s = s.replace(/[آأإءٱ]/g, 'ا'); // آ أ إ ء ٱ → ا
  s = s.replace(/ؤ/g, 'و'); // ؤ → و
  s = s.replace(/ئ/g, 'ي'); // ئ → ي
  s = s.replace(/ى/g, 'ي'); // ى → ي
  s = s.replace(/ة/g, 'ه'); // ة → ه
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Normalized whitespace tokens of the query. */
export function searchTokens(input) {
  const n = normalizeSearchText(input);
  return n ? n.split(' ') : [];
}

/**
 * True when every token of `query` appears (as a substring) somewhere in
 * `haystack`, after normalization. Order-independent and lenient.
 * An empty query matches everything.
 */
export function matchesAllTokens(haystack, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const h = normalizeSearchText(haystack);
  return tokens.every((tok) => h.includes(tok));
}

/** Convenience: does a single normalized query substring-match the haystack. */
export function normalizedIncludes(haystack, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return normalizeSearchText(haystack).includes(q);
}
