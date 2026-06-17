import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const requestBuckets = new Map();

function isPrivateIpv4(ip) {
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }
    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
    );
}

function isPrivateIp(ip) {
    const version = net.isIP(ip);
    if (version === 4) return isPrivateIpv4(ip);
    if (version !== 6) return true;

    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
    const v4Match = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Match) return isPrivateIpv4(v4Match[1]);
    return false;
}

function normalizeUrl(rawUrl) {
    const value = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
    if (typeof value !== 'string' || !value.trim()) {
        throw Object.assign(new Error('Missing url parameter'), { statusCode: 400 });
    }
    let parsed;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw Object.assign(new Error('Invalid url parameter'), { statusCode: 400 });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw Object.assign(new Error('Unsupported URL protocol'), { statusCode: 400 });
    }
    return parsed;
}

export async function validateProxyUrl(rawUrl) {
    const parsed = normalizeUrl(rawUrl);
    const hostname = parsed.hostname.replace(/\.$/, '').toLowerCase();
    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname === 'metadata.google.internal'
    ) {
        throw Object.assign(new Error('Blocked proxy host'), { statusCode: 403 });
    }

    const literalIpVersion = net.isIP(hostname);
    const addresses = literalIpVersion
        ? [{ address: hostname }]
        : await dns.lookup(hostname, { all: true, verbatim: true });

    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
        throw Object.assign(new Error('Blocked proxy address'), { statusCode: 403 });
    }

    return parsed;
}

function checkRateLimit(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000;
    const bucket = requestBuckets.get(ip) || { start: now, count: 0 };
    if (now - bucket.start > windowMs) {
        bucket.start = now;
        bucket.count = 0;
    }
    bucket.count += 1;
    requestBuckets.set(ip, bucket);
    if (bucket.count > 60) {
        throw Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 });
    }
}

async function fetchImageWithRedirects(initialUrl) {
    let currentUrl = await validateProxyUrl(initialUrl);

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response;
        try {
            response = await fetch(currentUrl, {
                redirect: 'manual',
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            if (redirectCount === MAX_REDIRECTS) {
                throw Object.assign(new Error('Too many redirects'), { statusCode: 400 });
            }
            currentUrl = await validateProxyUrl(new URL(response.headers.get('location'), currentUrl).toString());
            continue;
        }

        return response;
    }

    throw Object.assign(new Error('Too many redirects'), { statusCode: 400 });
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

    try {
        checkRateLimit(req);
        const response = await fetchImageWithRedirects(req.query?.url);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses can be proxied' });
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_BYTES) {
            return res.status(413).json({ error: 'Image too large' });
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) {
            return res.status(413).json({ error: 'Image too large' });
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).send(Buffer.from(arrayBuffer));
    } catch (error) {
        const statusCode = error?.name === 'AbortError' ? 504 : error?.statusCode || 500;
        const message = statusCode >= 500 ? 'Internal Server Error' : error.message;
        console.error('Proxy Error:', error);
        return res.status(statusCode).json({ error: message });
    }
}
