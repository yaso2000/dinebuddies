const functions = require('firebase-functions');
const {
    buildPrivateInvitationOgMeta,
    renderPrivateInvitationOgHtml,
    isSocialShareCrawler,
    shouldForceAppShell,
    extractShareTokenFromPath,
    resolveSiteOrigin,
} = require('./privateInvitationShareOgCore');

/**
 * @param {{ db: FirebaseFirestore.Firestore, findPublishedPrivateInvitationByShareToken: (token: string) => Promise<object|null>, normalizeShareToken: (raw: string) => string|null }} deps
 */
function createPrivateInvitationSharePageHandler(deps) {
    const { db, findPublishedPrivateInvitationByShareToken, normalizeShareToken } = deps;

    return functions.https.onRequest(async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.set('Allow', 'GET, HEAD');
            res.status(405).send('Method Not Allowed');
            return;
        }

        const token = normalizeShareToken(extractShareTokenFromPath(req.path));
        if (!token) {
            res.status(404).send('Not found');
            return;
        }

        const userAgent = req.get('user-agent') || '';
        const siteOrigin = resolveSiteOrigin();
        const forceAppShell = shouldForceAppShell(req.query);

        if (!forceAppShell && isSocialShareCrawler(userAgent)) {
            try {
                const inv = await findPublishedPrivateInvitationByShareToken(token);
                if (!inv) {
                    res.status(404).send('Invitation not found');
                    return;
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
                        /* ignore author lookup failure */
                    }
                }

                const meta = buildPrivateInvitationOgMeta(inv, token, inviterName, { siteOrigin });
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
                res.set('Vary', 'User-Agent');
                res.status(200).send(renderPrivateInvitationOgHtml(meta));
            } catch (err) {
                functions.logger.error('privateInvitationSharePage:og', err);
                res.status(500).send('Server error');
            }
            return;
        }

        try {
            const indexResponse = await fetch(`${siteOrigin}/index.html`, {
                headers: { Accept: 'text/html' },
            });
            if (!indexResponse.ok) {
                res.status(502).send('App unavailable');
                return;
            }
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Vary', 'User-Agent');
            res.status(200).send(await indexResponse.text());
        } catch (err) {
            functions.logger.error('privateInvitationSharePage:spa', err);
            res.status(502).send('App unavailable');
        }
    });
}

module.exports = { createPrivateInvitationSharePageHandler };
