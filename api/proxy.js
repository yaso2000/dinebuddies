import dns from 'node:dns/promises';
import net from 'node:net';
import { takeRateLimit } from './_rateLimit.js';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const BLOCKED_HOSTS = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata',
]);

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isPrivateIPv4(address) {
    const parts = address.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
    const [a, b, c] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0 && c === 0) ||
        (a === 192 && b === 0 && c === 2) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113) ||
        a >= 224
    );
}

function isPrivateIPv6(address) {
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith('::ffff:')) {
        const mapped = normalized.replace('::ffff:', '');
        return net.isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
    }
    return false;
}

export function isPrivateAddress(address) {
    const ipVersion = net.isIP(address);
    if (ipVersion === 4) return isPrivateIPv4(address);
    if (ipVersion === 6) return isPrivateIPv6(address);
    return true;
}

export async function assertSafeUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http and https URLs are supported');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
        throw new Error('Blocked host');
    }

    const directIpVersion = net.isIP(hostname);
    const addresses = directIpVersion
        ? [{ address: hostname }]
        : await dns.lookup(hostname, { all: true, verbatim: true });

    if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
        throw new Error('Blocked private or reserved address');
    }

    return parsed;
}

async function fetchWithSafeRedirects(rawUrl) {
    let current = await assertSafeUrl(rawUrl);

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(current.toString(), {
                redirect: 'manual',
                signal: controller.signal,
            });

            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                if (!location) throw new Error('Redirect missing location');
                if (redirectCount === MAX_REDIRECTS) throw new Error('Too many redirects');
                current = await assertSafeUrl(new URL(location, current).toString());
                continue;
            }

            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    throw new Error('Too many redirects');
}

async function readCappedResponse(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
        throw new Error('Image is too large');
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
        throw new Error('Image is too large');
    }
    return Buffer.from(arrayBuffer);
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limited = takeRateLimit(req, { key: 'api_proxy', limit: 120, windowMs: 60 * 1000 });
    res.setHeader('X-RateLimit-Remaining', String(limited.remaining));
    if (!limited.ok) {
        res.setHeader('Retry-After', String(limited.retryAfterSec));
        return res.status(429).json({ error: 'Too many requests' });
    }

    const rawUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
    if (!rawUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchWithSafeRedirects(rawUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses can be proxied' });
        }

        const buffer = await readCappedResponse(response);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(buffer);
    } catch (error) {
        const message = error?.name === 'AbortError' ? 'Upstream request timed out' : (error?.message || 'Proxy request failed');
        const status = /blocked|unsupported|url|host|address|redirect/i.test(message) ? 400 : 502;
        console.error('Proxy Error:', message);
        return res.status(status).json({ error: message });
    }
}
