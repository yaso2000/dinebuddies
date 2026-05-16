/**
 * Signed-in directory search (Admin SDK — bypasses Firestore client list limits).
 * Reuses runAdminSearchUsers prefix/email/uid logic; returns sanitized rows for the app.
 */
const functions = require('firebase-functions');
const { runAdminSearchUsers } = require('./adminSearchUsers');
const { isBusinessUserDoc } = require('./creditsCore');

/** Keep aligned with `src/utils/adminAccess.js` (directory search must not leak admin identities). */
const ADMIN_SEARCH_HIDE_EMAILS = new Set(
    [
        'admin@dinebuddies.com',
        'yaser@dinebuddies.com',
        'info@dinebuddies.com.au',
        'y.abohamed@gmail.com',
    ].map((e) => e.toLowerCase())
);
const ADMIN_SEARCH_HIDE_UIDS = new Set(['xTgHC1v00LZIZ6ESA9YGjGU5zW33']);

function excludeFromPeopleSearch(data, id) {
    const uid = String(id || data?.id || data?.uid || '');
    const role = String(data?.role || '').toLowerCase();
    if (
        ['business', 'partner', 'admin', 'staff', 'support', 'guest', 'moderator', 'affiliate_agent'].includes(
            role
        )
    ) {
        return true;
    }
    if (data?.isGuest === true) return true;
    if (String(data?.registrationChannel || '').toLowerCase() === 'affiliate_portal') return true;
    if (String(data?.authProvider || '').toLowerCase() === 'affiliate_email') return true;
    const email = String(data?.email || data?.authEmail || '').toLowerCase();
    if (email && ADMIN_SEARCH_HIDE_EMAILS.has(email)) return true;
    if (uid && ADMIN_SEARCH_HIDE_UIDS.has(uid)) return true;
    return false;
}

function toSearchUserRow(r) {
    const display_name = r.display_name || r.displayName || r.name || r.username || '';
    return {
        id: r.id,
        _type: 'user',
        display_name,
        displayName: display_name,
        name: r.name,
        username: r.username,
        email: r.email || r.authEmail || '',
        photo_url: r.photo_url || r.photoURL || null,
        photoURL: r.photoURL || r.photo_url || null,
        isOnline: r.isOnline,
    };
}

function toSearchBusinessRow(r) {
    const display_name = r.display_name || r.displayName || '';
    return {
        id: r.id,
        _type: 'business',
        display_name,
        displayName: display_name,
        businessInfo: r.businessInfo && typeof r.businessInfo === 'object' ? r.businessInfo : {},
        email: r.email || '',
        photo_url: r.photo_url || r.photoURL || null,
        photoURL: r.photoURL || r.photo_url || null,
        role: r.role,
    };
}

/** @param {Record<string, unknown>} exportsObj */
function registerDirectorySearch(exportsObj, { db, admin }) {
    exportsObj.directorySearch = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Sign in to search.');
        }
        const q = String(data?.q ?? data?.query ?? '').trim();
        if (q.length < 2) {
            throw new functions.https.HttpsError('invalid-argument', 'Query must be at least 2 characters.');
        }
        if (q.length > 120) {
            throw new functions.https.HttpsError('invalid-argument', 'Query too long.');
        }
        const uid = context.auth.uid;
        let rows;
        try {
            rows = await runAdminSearchUsers(db, admin, q);
        } catch (e) {
            functions.logger.error('[directorySearch] runAdminSearchUsers failed', e);
            throw new functions.https.HttpsError('internal', 'Search failed.');
        }
        const users = [];
        const businesses = [];
        const seenU = new Set();
        const seenB = new Set();
        for (const r of rows) {
            if (!r || !r.id || r.id === uid) continue;
            if (isBusinessUserDoc(r)) {
                if (!seenB.has(r.id)) {
                    seenB.add(r.id);
                    businesses.push(toSearchBusinessRow(r));
                }
            } else if (!excludeFromPeopleSearch(r, r.id)) {
                if (!seenU.has(r.id)) {
                    seenU.add(r.id);
                    users.push(toSearchUserRow(r));
                }
            }
        }
        return {
            users: users.slice(0, 50),
            businesses: businesses.slice(0, 50),
        };
    });
}

module.exports = { registerDirectorySearch };
