/**
 * Dynamic Sitemap Generator — /api/sitemap.xml
 *
 * Reads published business profiles from Firestore and generates
 * a valid XML sitemap for Google Search Console.
 *
 * Google will call: GET https://www.dinebuddies.com/api/sitemap.xml
 */

import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

// Lazy-init Firebase Admin (safe for serverless cold starts)
function getDb() {
    ensureFirebaseAdmin();
    return getFirestore();
}

const BASE_URL = 'https://www.dinebuddies.com';

// Static routes that should always appear in the sitemap
const STATIC_ROUTES = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/restaurants', priority: '0.9', changefreq: 'daily' },
];

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const db = getDb();

        // Fetch all published business profiles (role: 'business')
        const snapshot = await db
            .collection('users')
            .where('role', '==', 'business')
            .where('businessInfo.isPublished', '==', true)
            .get();

        const businessUrls = snapshot.docs.map((doc) => {
            const data = doc.data();
            const lastMod = data.businessInfo?.updatedAt
                ? new Date(data.businessInfo.updatedAt.toDate()).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];

            return {
                url: `/business/${doc.id}`,
                priority: '0.8',
                changefreq: 'weekly',
                lastmod: lastMod,
            };
        });

        const allRoutes = [...STATIC_ROUTES, ...businessUrls];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(route => `  <url>
    <loc>${BASE_URL}${route.url}</loc>
    ${route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ''}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        // Cache for 1 hour on CDN edge, 6 hours stale-while-revalidate
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=21600');
        return res.status(200).send(xml);

    } catch (error) {
        console.error('[sitemap] Error generating sitemap:', error);

        // Fallback: return a minimal static sitemap so Google doesn't fail completely
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
