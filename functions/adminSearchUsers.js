/**
 * Admin-only user search (Admin SDK — bypasses Firestore security rules).
 * Uses Auth getUserByEmail for reliable email lookup when Firestore is out of sync.
 */
const functions = require('firebase-functions');

const USER_NAME_PREFIX_FIELDS = [
    'display_name',
    'displayName',
    'nickname',
    'name',
    'businessInfo.businessName',
];

function nameSearchPrefixes(lower) {
    const words = lower.split(/\s+/).filter((w) => w.length >= 2);
    return [...new Set([lower, ...words])].slice(0, 6);
}

function deepPlainFirestoreValue(v, admin) {
    if (v === undefined || v === null) return v;
    if (typeof v === 'object') {
        if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
        if (v instanceof admin.firestore.GeoPoint) {
            return { latitude: v.latitude, longitude: v.longitude };
        }
        if (v instanceof admin.firestore.DocumentReference) return v.path;
        if (Array.isArray(v)) return v.map((x) => deepPlainFirestoreValue(x, admin));
        const out = {};
        for (const [k, val] of Object.entries(v)) {
            out[k] = deepPlainFirestoreValue(val, admin);
        }
        return out;
    }
    return v;
}

function plainUserRow(id, data, admin) {
    const base = data && typeof data === 'object' ? data : {};
    return { id, ...deepPlainFirestoreValue(base, admin) };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {string} raw
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
async function runAdminSearchUsers(db, admin, raw) {
    const term = String(raw || '').trim();
    if (!term) return [];

    const merged = new Map();

    if (/^[A-Za-z0-9]{20,128}$/.test(term)) {
        const d = await db.collection('users').doc(term).get();
        if (d.exists) {
            return [plainUserRow(d.id, d.data(), admin)];
        }
        return [];
    }

    const lower = term.toLowerCase();
    if (lower.includes('@')) {
        try {
            const authUser = await admin.auth().getUserByEmail(lower);
            const doc = await db.collection('users').doc(authUser.uid).get();
            if (doc.exists) {
                return [plainUserRow(doc.id, doc.data(), admin)];
            }
            return [
                plainUserRow(
                    authUser.uid,
                    {
                        email: authUser.email || lower,
                        authEmail: authUser.email || lower,
                        display_name: authUser.displayName || '',
                        displayName: authUser.displayName || '',
                        role: 'user',
                    },
                    admin
                ),
            ];
        } catch {
            /* fall through to Firestore */
        }
        const emails = [...new Set([lower, term])];
        for (const em of emails) {
            for (const field of ['email', 'authEmail']) {
                try {
                    const snap = await db.collection('users').where(field, '==', em).limit(25).get();
                    snap.docs.forEach((d) => merged.set(d.id, plainUserRow(d.id, d.data(), admin)));
                } catch (e) {
                    functions.logger.warn('[adminSearchUsers] email query failed', field, em, e.message);
                }
            }
        }
        return [...merged.values()];
    }

    const title =
        term.length > 0 ? term.charAt(0).toUpperCase() + (term.length > 1 ? lower.slice(1) : '') : lower;

    for (const p of nameSearchPrefixes(lower)) {
        try {
            const pubSnap = await db
                .collection('public_profiles')
                .where('search.displayNameLower', '>=', p)
                .where('search.displayNameLower', '<=', `${p}\uf8ff`)
                .orderBy('search.displayNameLower')
                .limit(40)
                .get();
            const ids = pubSnap.docs.map((d) => d.id);
            for (let i = 0; i < ids.length; i += 15) {
                const chunk = ids.slice(i, i + 15);
                const snaps = await Promise.all(chunk.map((id) => db.collection('users').doc(id).get()));
                snaps.forEach((us) => {
                    if (us.exists) merged.set(us.id, plainUserRow(us.id, us.data(), admin));
                });
            }
        } catch (e) {
            functions.logger.warn('[adminSearchUsers] public_profiles', p, e.message);
        }
    }

    const col = db.collection('users');
    for (const seg of nameSearchPrefixes(lower)) {
        const variants =
            seg === lower
                ? [...new Set([term, lower, term.toUpperCase(), title])].filter((v) => v.length >= 1)
                : [seg];
        for (const field of USER_NAME_PREFIX_FIELDS) {
            for (const v of variants) {
                try {
                    const snap = await col
                        .where(field, '>=', v)
                        .where(field, '<=', `${v}\uf8ff`)
                        .limit(35)
                        .get();
                    snap.docs.forEach((d) => merged.set(d.id, plainUserRow(d.id, d.data(), admin)));
                } catch (e) {
                    functions.logger.warn('[adminSearchUsers] users prefix', field, e.message);
                }
            }
        }
    }

    return [...merged.values()].slice(0, 60);
}

function registerAdminSearchUsers(exportsObj, { db, admin, assertAdminContext }) {
    exportsObj.adminSearchUsers = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const q = String(data?.query || '').trim().slice(0, 200);
        const users = await runAdminSearchUsers(db, admin, q);
        return { users };
    });
}

module.exports = { registerAdminSearchUsers, runAdminSearchUsers, plainUserRow, deepPlainFirestoreValue };
