/**
 * Paginated admin user browse (Admin SDK — bypasses client Firestore rules / missing role field).
 */
const functions = require('firebase-functions');
const { plainUserRow } = require('./adminSearchUsers');

const SCAN_BATCH = 80;
const MAX_SCAN = 2500;

const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator']);

/**
 * @param {Record<string, unknown>|undefined} data
 * @param {string} roleFilter
 */
function matchesRoleFilter(data, roleFilter, bannedOnly = false) {
    const r = String(data?.role || '').toLowerCase();
    let ok = false;
    switch (roleFilter) {
        case 'user':
            ok = !r || r === 'user';
            break;
        case 'business':
            ok = r === 'business' || r === 'partner';
            break;
        case 'affiliate_agent':
            ok = r === 'affiliate_agent';
            break;
        case 'team':
            ok = TEAM_ROLES.has(r);
            break;
        case 'all':
        default:
            ok = true;
    }
    if (bannedOnly) return ok && data?.banned === true;
    return ok;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {{ roleFilter: string, startAfterId: string|null, pageSize: number }} opts
 */
async function runAdminBrowseUsers(db, admin, { roleFilter, startAfterId, pageSize, bannedOnly }) {
    const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 50);
    const need = limit + 1;
    const rows = [];
    let cursor = startAfterId ? String(startAfterId) : null;
    let scanned = 0;
    const filter = String(roleFilter || 'all');
    const onlyBanned = bannedOnly === true;

    while (rows.length < need && scanned < MAX_SCAN) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(SCAN_BATCH);
        if (cursor) {
            q = q.startAfter(cursor);
        }
        const snap = await q.get();
        if (snap.empty) break;
        scanned += snap.size;
        for (const doc of snap.docs) {
            cursor = doc.id;
            if (matchesRoleFilter(doc.data(), filter, onlyBanned)) {
                rows.push(plainUserRow(doc.id, doc.data(), admin));
                if (rows.length >= need) break;
            }
        }
        if (snap.size < SCAN_BATCH) break;
    }

    const hasNext = rows.length > limit;
    const users = rows.slice(0, limit);
    return {
        users,
        hasNext,
        lastId: users.length ? users[users.length - 1].id : null,
        firstId: users.length ? users[0].id : null,
    };
}

function registerAdminBrowseUsers(exportsObj, { db, admin, assertAdminContext }) {
    exportsObj.adminBrowseUsers = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const roleFilter = String(data?.roleFilter || 'all').slice(0, 32);
        const startAfterId = data?.startAfterId ? String(data.startAfterId).slice(0, 128) : null;
        const pageSize = Number(data?.pageSize) || 25;
        const bannedOnly = data?.bannedOnly === true;
        return runAdminBrowseUsers(db, admin, { roleFilter, startAfterId, pageSize, bannedOnly });
    });
}

module.exports = { registerAdminBrowseUsers, runAdminBrowseUsers, matchesRoleFilter };
