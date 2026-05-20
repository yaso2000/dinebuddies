import dns from 'node:dns';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const dnsLookup = dns.promises.lookup.bind(dns.promises);

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
    '0.0.0.0'
]);

function isBlockedHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') return true;
    const h = hostname.toLowerCase().trim();
    return BLOCKED_HOSTNAMES.has(h) || h.endsWith('.local') || h.endsWith('.internal');
}

function isBlockedIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return true;
    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224
    );
}

function isBlockedIPv6(ip) {
    const norm = ip.toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('ff')) return true;
    if (norm.startsWith('::ffff:') && norm.slice(7).includes('.')) return isBlockedIPv4(norm.slice(7));
    return false;
}

function isBlockedIP(ip) {
    if (!ip || typeof ip !== 'string') return true;
    return ip.includes(':') ? isBlockedIPv6(ip.trim()) : isBlockedIPv4(ip.trim());
}

async function validateProxyUrl(targetUrl) {
    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return { ok: false, error: 'Invalid URL' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'URL scheme not allowed' };
    }
    if (parsed.username || parsed.password) {
        return { ok: false, error: 'URL credentials not allowed' };
    }
    if (isBlockedHostname(parsed.hostname)) {
        return { ok: false, error: 'URL hostname not allowed' };
    }

    try {
        const records = await dnsLookup(parsed.hostname, { all: true, family: 0 });
        if (!records.length || records.some((record) => isBlockedIP(record.address))) {
            return { ok: false, error: 'URL resolves to blocked address' };
        }
    } catch {
        return { ok: false, error: 'Could not resolve hostname' };
    }

    return { ok: true, url: parsed.toString() };
}

async function fetchWithValidatedRedirects(initialUrl) {
    let currentUrl = initialUrl;
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
        const validation = await validateProxyUrl(currentUrl);
        if (!validation.ok) {
            const err = new Error(validation.error);
            err.statusCode = 400;
            throw err;
        }

        const response = await fetch(validation.url, { redirect: 'manual' });
        if (![301, 302, 303, 307, 308].includes(response.status)) {
            return response;
        }

        const location = response.headers.get('location');
        if (!location) return response;
        currentUrl = new URL(location, validation.url).toString();
    }

    const err = new Error('Too many redirects');
    err.statusCode = 400;
    throw err;
}

async function readLimitedBody(response) {
    const reader = response.body?.getReader?.();
    if (!reader) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_BYTES) {
            const err = new Error('Response too large');
            err.statusCode = 413;
            throw err;
        }
        return buffer;
    }

    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            const err = new Error('Response too large');
            err.statusCode = 413;
            throw err;
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
}

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

    const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchWithValidatedRedirects(rawUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
            return res.status(413).json({ error: 'Response too large' });
        }

        const buffer = await readLimitedBody(response);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Internal Server Error' });
    }
}
