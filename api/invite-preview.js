/**
 * OG preview + SPA shell for /invite/p/:token (Vercel).
 * Social crawlers receive Open Graph HTML; humans receive index.html for the React app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

const require = createRequire(import.meta.url);
const {
    buildPrivateInvitationOgMeta,
    renderPrivateInvitationOgHtml,
    isSocialShareCrawler,
    shouldForceAppShell,
    resolveSiteOrigin,
} = require('../functions/privateInvitationShareOgCore.js');

function normalizeShareToken(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const token = raw.trim();
    if (token.length < 16 || token.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(token)) return null;
    return token;
}

async function findPublishedPrivateInvitationByShareToken(db, token) {
    const normalized = normalizeShareToken(token);
    if (!normalized) return null;
    const snap = await db
        .collection('social_invitations')
        .where('shareToken', '==', normalized)
        .limit(1)
        .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() || {};
    if (data.status !== 'published' || !data.publishedAt) return null;
    return { id: doc.id, ...data };
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

    const token = normalizeShareToken(req.query?.token);
    if (!token) {
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
            const inv = await findPublishedPrivateInvitationByShareToken(db, token);
            if (!inv) {
                return res.status(404).send('Invitation not found');
            }

            let inviterName =
                inv.author?.displayName || inv.author?.display_name || inv.author?.name || '';
            if (!inviterName && inv.authorId) {
                try {
                    const authorSnap = await db.collection('users').doc(inv.authorId).get();
                    if (authorSnap.exists) {
                        const author = authorSnap.data() || {};
                        inviterName =
                            author.display_name || author.displayName || author.name || '';
                    }
                } catch {
                    /* ignore */
                }
            }

            const meta = buildPrivateInvitationOgMeta(inv, token, inviterName, { siteOrigin });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
            res.setHeader('Vary', 'User-Agent');
            return res.status(200).send(renderPrivateInvitationOgHtml(meta));
        } catch (err) {
            console.error('[invite-preview] og', err);
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
