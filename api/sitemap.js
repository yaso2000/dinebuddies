/**
 * Dynamic Sitemap Generator — /sitemap.xml
 *
 * Lists published businesses from public_profiles (admin imports + partners)
 * and legacy published user business profiles.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

function getDb() {
    ensureFirebaseAdmin();
    return getFirestore();
}

const BASE_URL = 'https://www.dinebuddies.com';

const STATIC_ROUTES = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/restaurants', priority: '0.9', changefreq: 'daily' },
];

function isoDateFromFirestore(value) {
    try {
        if (value?.toDate) {
            return value.toDate().toISOString().split('T')[0];
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().split('T')[0];
        }
    } catch {
        /* ignore */
    }
    return new Date().toISOString().split('T')[0];
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function collectPublishedBusinessUrls(db) {
    /** @type {Map<string, { url: string, priority: string, changefreq: string, lastmod: string }>} */
    const byId = new Map();

    const addBusiness = (id, lastmodSource) => {
        const docId = String(id || '').trim();
        if (!docId) return;
        byId.set(docId, {
            url: `/business/${docId}`,
            priority: '0.8',
            changefreq: 'weekly',
            lastmod: isoDateFromFirestore(lastmodSource),
        });
    };

    try {
        const profileSnap = await db
            .collection('public_profiles')
            .where('profileType', '==', 'business')
            .where('businessPublic.isPublished', '==', true)
            .get();

        profileSnap.docs.forEach((docSnap) => {
            addBusiness(docSnap.id, docSnap.data()?.updatedAt);
        });
    } catch (err) {
        console.warn('[sitemap] public_profiles query failed', err?.message || err);
    }

    try {
        const userSnap = await db
            .collection('users')
            .where('role', '==', 'business')
            .where('businessInfo.isPublished', '==', true)
            .get();

        userSnap.docs.forEach((docSnap) => {
            if (!byId.has(docSnap.id)) {
                addBusiness(docSnap.id, docSnap.data()?.businessInfo?.updatedAt || docSnap.data()?.updated_at);
            }
        });
    } catch (err) {
        console.warn('[sitemap] users query failed', err?.message || err);
    }

    return [...byId.values()];
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const db = getDb();
        const businessUrls = await collectPublishedBusinessUrls(db);
        const allRoutes = [...STATIC_ROUTES, ...businessUrls];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
    .map(
        (route) => `  <url>
    <loc>${BASE_URL}${route.url}</loc>
    ${route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ''}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    )
    .join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=21600');
        return res.status(200).send(xml);
    } catch (error) {
        console.error('[sitemap] Error generating sitemap:', error);

        const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/restaurants</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        return res.status(200).send(fallbackXml);
    }
}
