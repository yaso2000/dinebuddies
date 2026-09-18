// Image proxy for share-card / canvas rendering (avoids CORS taint). Hardened:
// only https, only a fixed allowlist of trusted image hosts (blocks SSRF to
// internal/metadata endpoints), only image/* responses (blocks HTML/XSS on our
// origin), a size cap and timeout, and re-validation of the post-redirect host.
const ALLOWED_HOST_SUFFIXES = [
    'firebasestorage.googleapis.com',
    'firebasestorage.app',
    'storage.googleapis.com',
    'googleusercontent.com',
    'maps.googleapis.com',
    'maps.gstatic.com',
    'gstatic.com',
];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS = 10000;

function hostAllowed(hostname) {
    const host = String(hostname || '').toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

export default async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    let target;
    try {
        target = new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid url' });
    }
    if (target.protocol !== 'https:') {
        return res.status(400).json({ error: 'Only https URLs are allowed' });
    }
    if (!hostAllowed(target.hostname)) {
        return res.status(403).json({ error: 'Host not allowed' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(target.toString(), {
            redirect: 'follow',
            signal: controller.signal,
        });

        // Re-validate the final host in case a redirect left the allowlist (SSRF).
        let finalHost = '';
        try {
            finalHost = new URL(response.url).hostname;
        } catch {
            /* keep empty */
        }
        if (finalHost && !hostAllowed(finalHost)) {
            return res.status(403).json({ error: 'Redirected to a disallowed host' });
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: `Upstream ${response.status}` });
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }
        const declaredLen = Number(response.headers.get('content-length') || 0);
        if (declaredLen && declaredLen > MAX_BYTES) {
            return res.status(413).json({ error: 'Image too large' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > MAX_BYTES) {
            return res.status(413).json({ error: 'Image too large' });
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Proxy Error:', error?.message || error);
        return res.status(502).json({ error: 'Upstream fetch failed' });
    } finally {
        clearTimeout(timer);
    }
}
