/**
 * Detect, classify, and safely open URLs found in chat message text.
 * Blocks dangerous schemes / obfuscated hosts; external http(s) needs a leave-app confirm.
 */

const APP_HOST_SUFFIXES = ['dinebuddies.com'];

/** Common shorteners that hide the real destination — treat as unsafe in chat. */
const BLOCKED_SHORTENER_HOSTS = new Set([
  'bit.ly',
  'bitly.com',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'bl.ink',
  'lnkd.in',
  's.id',
  'v.gd',
  'tr.im',
  'clck.ru',
  'cutt.us',
  'soo.gd',
  'adf.ly',
]);

const URL_FIND_RE =
  /(?:https?:\/\/|www\.)[^\s<>"'`\u2066\u2067\u2069\u200e\u200f]+/gi;

const TRAILING_PUNCT_RE = /[),.!?;:،؛\]\}>'"…]+$/u;

/**
 * @typedef {'internal' | 'external' | 'blocked'} ChatLinkKind
 * @typedef {{ kind: ChatLinkKind, href: string, display: string, reason?: string }} ChatLinkInfo
 */

export function getAppHostname() {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '').toLowerCase();
}

export function isAppHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  const current = getAppHostname();
  if (current && h === current) return true;
  return APP_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function stripTrailingPunctuation(raw) {
  let value = String(raw || '');
  while (value && TRAILING_PUNCT_RE.test(value)) {
    value = value.replace(TRAILING_PUNCT_RE, '');
  }
  return value;
}

function isIpv4Host(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isBlockedShortener(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (BLOCKED_SHORTENER_HOSTS.has(h)) return true;
  for (const blocked of BLOCKED_SHORTENER_HOSTS) {
    if (h.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

/**
 * Normalize a raw URL token from chat into an absolute URL string, or ''.
 * @param {string} raw
 */
export function normalizeChatLinkCandidate(raw) {
  const trimmed = stripTrailingPunctuation(String(raw || '').trim());
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return '';
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    if (/[\s<>"']/.test(trimmed) || lower.includes('javascript:')) return '';
    return trimmed;
  }

  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * @param {string} raw
 * @returns {ChatLinkInfo | null}
 */
export function classifyChatLink(raw) {
  const display = stripTrailingPunctuation(String(raw || '').trim());
  if (!display) return null;

  const lower = display.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return { kind: 'blocked', href: '', display, reason: 'scheme' };
  }

  if (display.startsWith('/') && !display.startsWith('//')) {
    if (/[\s<>"']/.test(display) || lower.includes('javascript:')) {
      return { kind: 'blocked', href: '', display, reason: 'path' };
    }
    return { kind: 'internal', href: display, display };
  }

  const href = normalizeChatLinkCandidate(display);
  if (!href) {
    return { kind: 'blocked', href: '', display, reason: 'invalid' };
  }

  try {
    const parsed = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://www.dinebuddies.com');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { kind: 'blocked', href: '', display, reason: 'scheme' };
    }
    if (parsed.username || parsed.password) {
      return { kind: 'blocked', href: '', display, reason: 'credentials' };
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || isIpv4Host(host) || host === 'localhost' || host.endsWith('.local')) {
      return { kind: 'blocked', href: '', display, reason: 'host' };
    }
    if (isBlockedShortener(host)) {
      return { kind: 'blocked', href: '', display, reason: 'shortener' };
    }
    if (isAppHostname(host)) {
      const path = `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
      return { kind: 'internal', href: path || '/', display };
    }
    return { kind: 'external', href: parsed.href, display };
  } catch {
    return { kind: 'blocked', href: '', display, reason: 'invalid' };
  }
}

/**
 * Split message text into plain + link segments (linkify-ready).
 * @param {string} text
 * @returns {Array<{ type: 'text', value: string } | { type: 'link', value: string, info: ChatLinkInfo }>}
 */
export function splitTextWithChatLinks(text) {
  const raw = String(text || '');
  if (!raw) return [];

  const segments = [];
  let lastIndex = 0;
  URL_FIND_RE.lastIndex = 0;

  let match;
  while ((match = URL_FIND_RE.exec(raw)) !== null) {
    const full = match[0];
    const start = match.index;
    const cleaned = stripTrailingPunctuation(full);
    const trailing = full.slice(cleaned.length);

    if (start > lastIndex) {
      segments.push({ type: 'text', value: raw.slice(lastIndex, start) });
    }

    const info = classifyChatLink(cleaned);
    if (info) {
      segments.push({ type: 'link', value: cleaned, info });
    } else {
      segments.push({ type: 'text', value: cleaned });
    }

    if (trailing) {
      segments.push({ type: 'text', value: trailing });
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < raw.length) {
    segments.push({ type: 'text', value: raw.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: 'text', value: raw }];
}

export function messageContainsChatLink(text) {
  return splitTextWithChatLinks(text).some((part) => part.type === 'link');
}
