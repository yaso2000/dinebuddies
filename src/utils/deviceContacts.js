/**
 * Contact Picker API (Android Chrome / some PWAs). User must approve each pick — never bulk-reads the book.
 */

export function isContactPickerSupported() {
    if (typeof navigator === 'undefined') return false;
    return 'contacts' in navigator && typeof window !== 'undefined' && 'ContactsManager' in window;
}

/** @param {unknown} raw */
export function normalizePhoneTel(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const cleaned = s.replace(/[^\d+]/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('+')) return `+${cleaned.slice(1).replace(/\D/g, '')}`;
    return cleaned.replace(/\D/g, '');
}

/** @param {string[]} names */
export function pickContactDisplayName(names) {
    if (!Array.isArray(names) || names.length === 0) return '';
    const first = String(names[0] || '').trim();
    return first || '';
}

/**
 * @param {Array<{ name?: string[]; tel?: string[] }>} pickerRows
 * @returns {{ name: string; tel: string }[]}
 */
export function mapPickerContactsToEntries(pickerRows) {
    if (!Array.isArray(pickerRows)) return [];
    const out = [];
    const seen = new Set();

    for (const row of pickerRows) {
        const name = pickContactDisplayName(row?.name);
        const tels = Array.isArray(row?.tel) ? row.tel : [];
        for (const rawTel of tels) {
            const tel = normalizePhoneTel(rawTel);
            if (!tel || seen.has(tel)) continue;
            seen.add(tel);
            out.push({ name: name || tel, tel });
        }
    }
    return out;
}

/**
 * @returns {Promise<{ ok: true; contacts: { name: string; tel: string }[] } | { ok: false; reason: string }>}
 */
export async function pickDeviceContacts() {
    if (!isContactPickerSupported()) {
        return { ok: false, reason: 'unsupported' };
    }
    try {
        const rows = await navigator.contacts.select(['name', 'tel'], { multiple: true });
        return { ok: true, contacts: mapPickerContactsToEntries(rows) };
    } catch (err) {
        if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
            return { ok: false, reason: 'cancelled' };
        }
        console.error('[deviceContacts] pick failed:', err);
        return { ok: false, reason: 'error' };
    }
}

/**
 * @param {{ name: string; tel: string }[]} existing
 * @param {{ name: string; tel: string }[]} added
 * @param {number} max
 */
/**
 * Split pasted text (comma / newline / semicolon) into phone entries.
 * @param {string} text
 * @returns {{ name: string; tel: string }[]}
 */
export function parsePastedPhoneEntries(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    const parts = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    const seen = new Set();

    for (const part of parts) {
        const directTel = normalizePhoneTel(part);
        if (directTel && !seen.has(directTel)) {
            seen.add(directTel);
            out.push({ name: directTel, tel: directTel });
            continue;
        }
        const tokens = part.split(/\s+/).filter(Boolean);
        if (tokens.length < 2) continue;
        const tel = normalizePhoneTel(tokens[tokens.length - 1]);
        if (!tel || seen.has(tel)) continue;
        seen.add(tel);
        const name = tokens.slice(0, -1).join(' ').trim() || tel;
        out.push({ name, tel });
    }
    return out;
}

export function mergePhoneContacts(existing, added, max) {
    const map = new Map();
    for (const c of existing || []) {
        const tel = normalizePhoneTel(c?.tel);
        if (!tel) continue;
        map.set(tel, { name: String(c?.name || tel).trim() || tel, tel });
    }
    for (const c of added || []) {
        const tel = normalizePhoneTel(c?.tel);
        if (!tel) continue;
        if (!map.has(tel) && map.size >= max) continue;
        map.set(tel, { name: String(c?.name || tel).trim() || tel, tel });
    }
    return Array.from(map.values()).slice(0, max);
}
