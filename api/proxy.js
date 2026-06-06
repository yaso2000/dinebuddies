import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata',
]);

function normalizeHostname(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isPrivateIPv4(address) {
    const parts = address.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }
    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );
}

function isPrivateIPv6(address) {
    const normalized = address.toLowerCase();
    return (
        normalized === '::1' ||
        normalized === '::' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:') ||
        normalized.startsWith('::ffff:127.') ||
        normalized.startsWith('::ffff:10.') ||
        normalized.startsWith('::ffff:192.168.') ||
        normalized.startsWith('::ffff:169.254.')
    );
}

function isBlockedAddress(address) {
    const ipVersion = net.isIP(address);
    if (ipVersion === 4) return isPrivateIPv4(address);
    if (ipVersion === 6) return isPrivateIPv6(address);
    return true;
}

async function validateProxyUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only http and https URLs are supported');
    }

    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
        throw new Error('Blocked proxy hostname');
    }

    if (net.isIP(hostname)) {
        if (isBlockedAddress(hostname)) throw new Error('Blocked proxy address');
        return parsed;
    }

    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isBlockedAddress(record.address))) {
        throw new Error('Blocked proxy DNS target');
    }

    return parsed;
}

async function fetchWithValidatedRedirects(initialUrl) {
    let current = await validateProxyUrl(initialUrl);

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(current, {
                redirect: 'manual',
                signal: controller.signal,
            });

            if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
                if (redirects === MAX_REDIRECTS) throw new Error('Too many redirects');
                current = await validateProxyUrl(new URL(response.headers.get('location'), current).toString());
                continue;
            }

            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    throw new Error('Too many redirects');
}

async function readLimitedBody(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
        throw new Error('Upstream image is too large');
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) throw new Error('Upstream image is too large');
        return Buffer.from(arrayBuffer);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            await reader.cancel();
            throw new Error('Upstream image is too large');
        }
        chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    if (req.method && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? url[0] : url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchWithValidatedRedirects(targetUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses can be proxied' });
        }

        const buffer = await readLimitedBody(response);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Proxy Error:', error);
        const message = error.name === 'AbortError' ? 'Upstream request timed out' : error.message;
        return res.status(400).json({ error: message || 'Proxy request blocked' });
    }
}
