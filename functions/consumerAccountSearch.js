/**
 * Consumer account search (users + businesses) via Admin SDK.
 */
const functions = require('firebase-functions');

const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent']);

function isExcludedRole(role) {
    return TEAM_ROLES.has(String(role || '').toLowerCase());
}

function mapRow(id, data) {
    const isBiz = data.profileType === 'business';
    const businessPublic = data.businessPublic || {};
    return {
        id,
        _type: isBiz ? 'business' : 'user',
        display_name: data.displayName || 'User',
        displayName: data.displayName || 'User',
        photoURL: data.avatarUrl || null,
        photo_url: data.avatarUrl || null,
        subscriptionTier: data.subscriptionTier || 'free',
        businessInfo: isBiz
            ? {
                  businessName: data.displayName,
                  businessType: businessPublic.businessType,
                  city: businessPublic.city,
                  address: businessPublic.address,
                  description: businessPublic.description,
              }
            : undefined,
    };
}

function acceptProfile(data, profileType) {
    if ((data.profileType || 'user') !== profileType) return false;
    if (data?.isGuest === true) return false;
    if (data?.searchable === false) return false;
    if (isExcludedRole(data.accountRole)) return false;
    if (profileType === 'business' && data.businessPublic?.isPublished !== true) return false;
    return true;
}

async function queryProfilesByType(db, term, profileType) {
    const lower = term.trim().toLowerCase();
    if (!lower) return [];

    const prefix = lower.slice(0, Math.min(lower.length, 40));
    const end = `${prefix}\uf8ff`;
    const merged = new Map();

    const collect = (snap) => {
        snap.docs.forEach((d) => {
            const data = d.data();
            if (!acceptProfile(data, profileType)) return;
            merged.set(d.id, mapRow(d.id, data));
        });
    };

    try {
        const snap = await db
            .collection('public_profiles')
            .where('profileType', '==', profileType)
            .where('search.displayNameLower', '>=', prefix)
            .where('search.displayNameLower', '<=', end)
            .orderBy('search.displayNameLower')
            .limit(60)
            .get();
        collect(snap);
    } catch (e) {
        functions.logger.warn('[consumerAccountSearch] typed query failed', profileType, e.message);
        try {
            const snap = await db
                .collection('public_profiles')
                .where('search.displayNameLower', '>=', prefix)
                .where('search.displayNameLower', '<=', end)
                .orderBy('search.displayNameLower')
                .limit(100)
                .get();
            collect(snap);
        } catch (e2) {
            functions.logger.warn('[consumerAccountSearch] fallback query failed', profileType, e2.message);
        }
    }

    return [...merged.values()];
}

async function searchUsersCollectionAdmin(db, term) {
    const raw = term.trim();
    const lower = raw.toLowerCase();
    if (raw.length < 2) return [];

    const end = `${raw}\uf8ff`;
    const merged = new Map();

    const add = (id, data) => {
        const role = String(data?.role || '').toLowerCase();
        if (role === 'business' || role === 'partner' || role === 'guest' || data?.isGuest) return;
        if (isExcludedRole(role)) return;
        const display = data?.display_name || data?.displayName || data?.name || '';
        if (!display.toLowerCase().includes(lower)) return;
        merged.set(id, {
            id,
            _type: 'user',
            display_name: display,
            displayName: display,
            photoURL: data?.photoURL || data?.photo_url || null,
            photo_url: data?.photo_url || data?.photoURL || null,
        });
    };

    for (const field of ['display_name', 'displayName']) {
        try {
            const snap = await db
                .collection('users')
                .orderBy(field)
                .startAt(raw)
                .endAt(end)
                .limit(40)
                .get();
            snap.docs.forEach((d) => add(d.id, d.data()));
        } catch (err) {
            functions.logger.warn('[consumerAccountSearch] users scan failed', field, err.message);
        }
    }

    return [...merged.values()];
}

async function runConsumerAccountSearch(db, rawTerm) {
    const term = String(rawTerm || '').trim().slice(0, 80);
    if (!term) {
        return { businesses: [], users: [] };
    }

    const checkQ = term.toLowerCase();
    if (checkQ.includes('admin') || checkQ.includes('أدمن') || checkQ.includes('ادمن')) {
        return { businesses: [], users: [] };
    }

    let [businesses, users] = await Promise.all([
        queryProfilesByType(db, term, 'business'),
        queryProfilesByType(db, term, 'user'),
    ]);

    if (!users.length) {
        users = await searchUsersCollectionAdmin(db, term);
    }

    return { businesses, users };
}

function registerConsumerAccountSearch(exportsObj, { db }) {
    exportsObj.consumerAccountSearch = functions.region('us-central1').https.onCall(async (data) => {
        const term = String(data?.term || data?.query || '').trim();
        return runConsumerAccountSearch(db, term);
    });

    /** GET ?term= — same-origin via Vercel/Firebase hosting rewrite (reliable on iOS Safari). */
    exportsObj.consumerAccountSearchHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
        res.set('Access-Control-Max-Age', '86400');
        res.set('Cache-Control', 'private, max-age=0, no-store');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        if (req.method !== 'GET') {
            res.status(405).json({ error: 'method_not_allowed' });
            return;
        }

        try {
            const term = String(req.query.term || req.query.q || '').trim();
            const payload = await runConsumerAccountSearch(db, term);
            res.status(200).json(payload);
        } catch (err) {
            functions.logger.error('[consumerAccountSearchHttp]', err);
            res.status(500).json({ error: 'search_failed', message: err?.message || 'search_failed' });
        }
    });
}

module.exports = { registerConsumerAccountSearch, runConsumerAccountSearch };
