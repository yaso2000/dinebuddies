import dns from 'dns';
import { takeRateLimit } from './_rateLimit.js';

const dnsLookup = dns.promises.lookup.bind(dns.promises);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain',
    'localhost4',
    'localhost6',
    'ip6-localhost',
    'ip6-loopback',
    'ipv6-localhost',
    'ipv6-loopback',
    'metadata',
    'metadata.google.internal',
    'metadata.google.com',
    '169.254.169.254',
    '::1',
    '0.0.0.0',
]);

function isBlockedHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') return true;
    const h = hostname.toLowerCase().trim();
    return BLOCKED_HOSTNAMES.has(h) || h.endsWith('.local') || h.endsWith('.internal');
}

function isBlockedIPv4(ip) {
    const parts = String(ip || '').split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224;
}

function isBlockedIPv6(ip) {
    const norm = String(ip || '').toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('ff')) return true;
    if (norm.startsWith('::ffff:') && norm.includes('.')) return isBlockedIPv4(norm.slice(7));
    return false;
}

function isBlockedIP(address) {
    const ip = String(address || '').trim();
    if (!ip) return true;
    return ip.includes(':') ? isBlockedIPv6(ip) : isBlockedIPv4(ip);
}

export async function validateProxyUrl(targetUrl) {
    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return { ok: false, error: 'Invalid URL' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'URL scheme not allowed' };
    }
    if (isBlockedHostname(parsed.hostname)) {
        return { ok: false, error: 'URL hostname not allowed' };
    }

    try {
        const results = await dnsLookup(parsed.hostname, { all: true, family: 0 });
        if (!Array.isArray(results) || results.length === 0 || results.some((result) => isBlockedIP(result.address))) {
            return { ok: false, error: 'URL resolves to blocked address' };
        }
    } catch {
        return { ok: false, error: 'Could not resolve hostname' };
    }

    return { ok: true };
}

async function fetchPublicImage(targetUrl) {
    let currentUrl = targetUrl;
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
        const validation = await validateProxyUrl(currentUrl);
        if (!validation.ok) {
            const err = new Error(validation.error || 'Invalid URL');
            err.status = 400;
            throw err;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(currentUrl, {
                redirect: 'manual',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'DineBuddiesImageProxy/1.0',
                    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                },
            });
        } finally {
            clearTimeout(timeout);
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) break;
            currentUrl = new URL(location, currentUrl).href;
            continue;
        }

        if (!response.ok) {
            const err = new Error(`Failed to fetch image: ${response.statusText}`);
            err.status = response.status;
            throw err;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            const err = new Error('Only image responses are allowed');
            err.status = 415;
            throw err;
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_BYTES) {
            const err = new Error('Image response is too large');
            err.status = 413;
            throw err;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > MAX_BYTES) {
                const err = new Error('Image response is too large');
                err.status = 413;
                throw err;
            }
            return { buffer, contentType };
        }

        const chunks = [];
        let total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAX_BYTES) {
                const err = new Error('Image response is too large');
                err.status = 413;
                throw err;
            }
            chunks.push(Buffer.from(value));
        }
        return { buffer: Buffer.concat(chunks), contentType };
    }

    const err = new Error('Redirect limit exceeded');
    err.status = 400;
    throw err;
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = takeRateLimit(req, { key: 'api-proxy', limit: 60, windowMs: 60 * 1000 });
    res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
    if (!limit.ok) {
        res.setHeader('Retry-After', String(limit.retryAfterSec));
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? url[0] : url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const { buffer, contentType } = await fetchPublicImage(targetUrl);
        res.setHeader('Content-Type', contentType);

        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
    }
}
