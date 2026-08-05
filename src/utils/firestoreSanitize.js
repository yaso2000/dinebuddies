function isFirestoreSpecial(value) {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.toDate === 'function') return true;
    if (typeof value._methodName === 'string') return true;
    if (value.constructor && value.constructor.name === 'Timestamp') return true;
    return false;
}

/** Remove `undefined` values so Firestore writes succeed (common on mobile WebView). */
export function stripUndefinedDeep(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (isFirestoreSpecial(value)) return value;
    if (Array.isArray(value)) {
        return value.map((item) => stripUndefinedDeep(item)).filter((item) => item !== undefined);
    }
    if (typeof value !== 'object') return value;

    const out = {};
    for (const [key, val] of Object.entries(value)) {
        const cleaned = stripUndefinedDeep(val);
        if (cleaned !== undefined) {
            out[key] = cleaned;
        }
    }
    return out;
}
