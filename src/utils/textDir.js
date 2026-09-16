// Text direction from the first strong character; empty value falls back to the
// UI language (Arabic UI → RTL default, then flips to LTR the moment English is
// typed). Same behaviour the feed post composer uses, shared here so comments
// stay consistent with posts.
const RTL_CHARS = /[֑-߿יִ-﷽ﹰ-ﻼ]/;
const LTR_CHARS = /[A-Za-zÀ-ɏ]/;

export function textDir(value, fallback = 'ltr') {
  const s = String(value || '');
  for (const ch of s) {
    if (RTL_CHARS.test(ch)) return 'rtl';
    if (LTR_CHARS.test(ch)) return 'ltr';
  }
  return fallback;
}

export default textDir;
