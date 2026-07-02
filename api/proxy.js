import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 0
    );
}

function isPrivateIPv6(ip) {
    const normalized = ip.toLowerCase();
    return (
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:') ||
        normalized === '::' ||
        normalized.startsWith('::ffff:127.') ||
        normalized.startsWith('::ffff:10.') ||
        normalized.startsWith('::ffff:192.168.') ||
        normalized.startsWith('::ffff:169.254.')
    );
}

function isBlockedAddress(address) {
    const version = net.isIP(address);
    if (version === 4) return isPrivateIPv4(address);
    if (version === 6) return isPrivateIPv6(address);
    return true;
}

async function assertSafeUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Only http(s) URLs are supported');
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
        throw new Error('Unsafe URL');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Localhost is not allowed');
    }

    if (net.isIP(hostname)) {
        if (isBlockedAddress(hostname)) throw new Error('Private IPs are not allowed');
        return parsed;
    }

    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isBlockedAddress(record.address))) {
        throw new Error('Host resolves to a private address');
    }
    return parsed;
}

async function fetchImageSafely(rawUrl, redirectsLeft = MAX_REDIRECTS) {
    const parsed = await assertSafeUrl(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(parsed.toString(), {
            redirect: 'manual',
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        if (redirectsLeft <= 0) throw new Error('Too many redirects');
        const next = new URL(response.headers.get('location'), parsed);
        return fetchImageSafely(next.toString(), redirectsLeft - 1);
    }

    return response;
}

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchImageSafely(Array.isArray(url) ? url[0] : url);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }
        if (contentType) res.setHeader('Content-Type', contentType);

        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (declaredLength > MAX_BYTES) {
            return res.status(413).json({ error: 'Image is too large' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > MAX_BYTES) {
            return res.status(413).json({ error: 'Image is too large' });
        }

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        // Fallback for older Node versions if fetch is missing (unlikely on Vercel)
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
