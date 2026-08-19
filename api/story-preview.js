/**
 * OG preview + SPA shell for /story/:id (Vercel). Social crawlers get Open Graph HTML;
 * humans get index.html for the React app (same split as api/invite-preview.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

const require = createRequire(import.meta.url);
const {
    buildStoryOgMeta,
    renderStoryOgHtml,
    isStoryExpired,
    isSocialShareCrawler,
    shouldForceAppShell,
    resolveSiteOrigin,
} = require('../functions/storyShareOgCore.js');

function normalizeStoryId(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const id = raw.trim();
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

    const storyId = normalizeStoryId(req.query?.id);
    if (!storyId) {
        return res.status(404).send('Not found');
    }

    const userAgent = req.headers['user-agent'] || '';
    const siteOrigin = resolveSiteOrigin(process.env.SITE_ORIGIN || 'https://www.dinebuddies.com');
    const forceAppShell = shouldForceAppShell(req.query);

    if (!forceAppShell && isSocialShareCrawler(userAgent)) {
        try {
            ensureFirebaseAdmin();
            const { getFirestore } = await import('firebase-admin/firestore');
            const db = getFirestore();
            const snap = await db.collection('stories').doc(storyId).get();
            if (!snap.exists) {
                return res.status(404).send('Story not found');
            }
            const story = snap.data();
            if (isStoryExpired(story)) {
                return res.status(404).send('Story expired');
            }

            const meta = buildStoryOgMeta(story, storyId, { siteOrigin });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            // Stories are ephemeral (24h) — a short cache so a stale crawler snapshot
            // doesn't outlive the content by much.
            res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300');
            res.setHeader('Vary', 'User-Agent');
            return res.status(200).send(renderStoryOgHtml(meta));
        } catch (err) {
            console.error('[story-preview] og', err);
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
    return res.status(200).send(indexHtml);
}
