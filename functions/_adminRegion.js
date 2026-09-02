/**
 * Region scoping for the admin panel.
 * A `regional_manager` (users/{uid}.role='regional_manager', .region='<key>')
 * may only see/act on data whose country is inside their region. Full admins
 * (super owner, custom-claim admin, or role admin/moderator/support/staff) are
 * unscoped. Fail closed: a regional_manager with an unknown region sees nothing.
 */

/** Region key → ISO country codes it covers. */
const ADMIN_REGION_COUNTRIES = {
    gulf: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
};

/** @param {string} regionKey @returns {string[] | null} */
function regionCountries(regionKey) {
    const key = String(regionKey || '').trim().toLowerCase();
    return ADMIN_REGION_COUNTRIES[key] || null;
}

/**
 * Resolve a document's ISO-2 country code from the various shapes used across
 * users / businesses / invitations. Returns an upper-case 2-char code or null.
 * @param {any} data
 */
function docCountryCode(data) {
    if (!data || typeof data !== 'object') return null;
    const candidates = [
        data.countryCode,
        data.country,
        data.userCountryCode,
        data.businessInfo?.countryCode,
        data.businessInfo?.country,
        data.businessPublic?.countryCode,
        data.businessPublic?.country,
        data.location?.countryCode,
        data.location?.country,
    ];
    for (const raw of candidates) {
        if (raw == null || raw === '') continue;
        const s = String(raw).trim();
        if (s.length === 2) return s.toUpperCase();
    }
    return null;
}

/**
 * Scope for the calling admin.
 * @param {string} role
 * @param {string} regionKey
 * @returns {{ scoped: boolean, countries: string[] }}
 */
function resolveCallerRegionScope(role, regionKey) {
    if (String(role || '').toLowerCase() === 'regional_manager') {
        // Always scoped. Unknown/missing region => empty set => sees nothing (fail closed).
        return { scoped: true, countries: regionCountries(regionKey) || [] };
    }
    return { scoped: false, countries: [] };
}

/**
 * Does a document fall inside the caller's region scope?
 * Unscoped callers always pass. A doc with no resolvable country FAILS a scoped
 * check (a regional manager should not see un-localizable data).
 * @param {any} data
 * @param {{ scoped: boolean, countries: string[] }} scope
 */
function docInRegionScope(data, scope) {
    if (!scope || !scope.scoped) return true;
    const cc = docCountryCode(data);
    if (!cc) return false;
    return scope.countries.includes(cc);
}

/**
 * For scoped callers, confirm a target user doc is inside the region before an
 * action (ban/freeze/etc.). Unscoped callers always pass. One extra read.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} targetUid
 * @param {{ scoped: boolean, countries: string[] }} scope
 * @returns {Promise<boolean>}
 */
async function targetUserInRegion(db, targetUid, scope) {
    if (!scope || !scope.scoped) return true;
    if (!targetUid) return false;
    const snap = await db.collection('users').doc(String(targetUid)).get();
    return snap.exists && docInRegionScope(snap.data(), scope);
}

/**
 * Batch-resolve a set of user uids → their ISO country code. One `getAll`.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} uids
 * @returns {Promise<Map<string, string|null>>}
 */
async function userCountryMap(db, uids) {
    const unique = [...new Set((uids || []).filter(Boolean).map(String))];
    const out = new Map();
    if (!unique.length) return out;
    const refs = unique.map((u) => db.collection('users').doc(u));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
        out.set(snap.id, snap.exists ? docCountryCode(snap.data()) : null);
    }
    return out;
}

/**
 * Filter rows to those whose owner user (by `getUid(row)`) is in the caller's
 * region. Used for entities that carry no country of their own (posts, reports,
 * support tickets) — the owner user's country is the scoping key. Unscoped
 * callers keep all rows.
 * @template T
 * @param {FirebaseFirestore.Firestore} db
 * @param {T[]} rows
 * @param {(row: T) => string} getUid
 * @param {{ scoped: boolean, countries: string[] }} scope
 * @returns {Promise<T[]>}
 */
async function filterByOwnerRegion(db, rows, getUid, scope) {
    if (!scope || !scope.scoped) return rows || [];
    const map = await userCountryMap(db, (rows || []).map(getUid));
    return (rows || []).filter((row) => {
        const cc = map.get(String(getUid(row) || ''));
        return cc && scope.countries.includes(cc);
    });
}

module.exports = {
    ADMIN_REGION_COUNTRIES,
    regionCountries,
    docCountryCode,
    resolveCallerRegionScope,
    docInRegionScope,
    targetUserInRegion,
    userCountryMap,
    filterByOwnerRegion,
};
