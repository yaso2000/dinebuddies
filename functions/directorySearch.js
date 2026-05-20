/**
 * Public business directory search (public_profiles projection).
 */
const functions = require('firebase-functions');

function mapDirectoryRow(doc) {
    const p = doc.data() || {};
    return {
        id: doc.id,
        displayName: p.displayName || '',
        avatarUrl: p.avatarUrl || null,
        businessPublic: p.businessPublic || null,
    };
}

function registerDirectorySearch(exportsObj, { db }) {
    exportsObj.directorySearch = functions.https.onCall(async (data) => {
        const q = String(data?.query || '').trim().toLowerCase().slice(0, 120);
        if (q.length < 2) {
            return { results: [] };
        }

        const snap = await db
            .collection('public_profiles')
            .where('profileType', '==', 'business')
            .where('businessPublic.isPublished', '==', true)
            .where('search.displayNameLower', '>=', q)
            .where('search.displayNameLower', '<=', `${q}\uf8ff`)
            .limit(30)
            .get();

        return { results: snap.docs.map(mapDirectoryRow) };
    });
}

module.exports = { registerDirectorySearch };
