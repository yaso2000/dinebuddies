import { normalizePhoneTel } from './deviceContacts';

/** @param {string[]} phoneNumbers */
export function buildBulkSmsUrl(phoneNumbers, body = '') {
    const nums = (phoneNumbers || []).map(normalizePhoneTel).filter(Boolean);
    if (!nums.length) return null;
    const query = body ? `?body=${encodeURIComponent(body)}` : '';
    return `sms:${nums.join(',')}${query}`;
}

/**
 * Opens the device SMS app with one message and multiple recipients (best on Android).
 * @param {string[]} phoneNumbers
 * @param {string} body
 */
export function openBulkSms(phoneNumbers, body = '') {
    const url = buildBulkSmsUrl(phoneNumbers, body);
    if (!url || typeof window === 'undefined') return false;
    window.location.assign(url);
    return true;
}

/** iOS: no recipients in URL — user picks contacts inside Messages (+ button). */
export function buildSmsBodyOnlyUrl(body = '') {
    const trimmed = String(body || '').trim();
    if (!trimmed) return 'sms:';
    return `sms:?body=${encodeURIComponent(trimmed)}`;
}

/** @param {string} body */
export function openSmsWithBodyOnly(body = '') {
    if (typeof window === 'undefined') return false;
    window.location.assign(buildSmsBodyOnlyUrl(body));
    return true;
}

/**
 * @param {{ name: string; tel: string }[]} contacts
 * @param {string} messageBody
 */
export function buildBulkSmsBodyWithRecipients(contacts, messageBody) {
    const names = (contacts || [])
        .map((c) => String(c?.name || '').trim())
        .filter(Boolean);
    const base = String(messageBody || '').trim();
    if (!names.length) return base;
    const line = `To: ${names.join(', ')}`;
    return base ? `${line}\n\n${base}` : line;
}
