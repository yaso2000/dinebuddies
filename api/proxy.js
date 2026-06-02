import { takeRateLimit } from './_rateLimit.js';
import { fetchWithValidatedRedirects, readBodyWithLimit } from './_proxyUrl.js';

const MAX_PROXY_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = takeRateLimit(req, { key: 'image-proxy', limit: 30, windowMs: 60_000 });
    res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
    if (!limit.ok) {
        res.setHeader('Retry-After', String(limit.retryAfterSec));
        return res.status(429).json({ error: 'Too many requests' });
    }

    const { url } = req.query;

    if (!url || Array.isArray(url)) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetchWithValidatedRedirects(url, { signal: controller.signal });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

        const buffer = await readBodyWithLimit(response, MAX_PROXY_BYTES);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        if (error.name === 'AbortError') {
            return res.status(504).json({ error: 'Proxy request timed out' });
        }
        const status = Number(error.statusCode) || 500;
        res.status(status).json({ error: status === 500 ? 'Internal Server Error' : error.message });
    } finally {
        clearTimeout(timeout);
    }
}
