/**
 * SEO + OG HTML for /business/:id (Vercel).
 * Search/social crawlers receive structured HTML; humans receive the SPA shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import {
    buildBusinessSeoMeta,
    isBusinessSeoCrawler,
    loadPublishedBusinessForSeo,
    renderBusinessSeoHtml,
    resolveSiteOrigin,
    shouldForceAppShell,
} from './_businessSeoCore.js';

function normalizeBusinessId(raw) {
    const id = String(raw || '').trim();
    if (!id || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    return id;
}

function readSpaIndexHtml() {
    const candidates = [
        path.join(process.cwd(), 'dist', 'index.html'),
        path.join(process.cwd(), 'index.html'),
    ];
    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf8');
            }
        } catch {
            /* try next */
        }
    }
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method Not Allowed');
    }

    const businessId = normalizeBusinessId(req.query?.id);
    if (!businessId) {
        return res.status(404).send('Not found');
    }

    const userAgent = req.headers['user-agent'] || '';
    const siteOrigin = resolveSiteOrigin(process.env.SITE_ORIGIN);
    const forceAppShell = shouldForceAppShell(req.query);

    if (!forceAppShell && isBusinessSeoCrawler(userAgent)) {
        try {
            ensureFirebaseAdmin();
            const { getFirestore } = await import('firebase-admin/firestore');
            const db = getFirestore();
            const business = await loadPublishedBusinessForSeo(db, businessId);
            if (!business) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=300');
                return res.status(404).send('Business not found');
            }

            const meta = buildBusinessSeoMeta(business, siteOrigin);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200');
            res.setHeader('Vary', 'User-Agent');
            if (req.method === 'HEAD') return res.status(200).end();
            return res.status(200).send(renderBusinessSeoHtml(meta));
        } catch (err) {
            console.error('[business-preview]', businessId, err);
            return res.status(500).send('Server error');
        }
    }

    const indexHtml = readSpaIndexHtml();
    if (!indexHtml) {
        return res.status(502).send('App unavailable');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Vary', 'User-Agent');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(indexHtml);
}
