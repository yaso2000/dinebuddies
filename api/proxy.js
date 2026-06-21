import dns from 'dns/promises';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
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
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
    return false;
}

function isBlockedIPv6(ip) {
    const norm = ip.toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('ff')) return true;
    if (norm.startsWith('::ffff:') && norm.includes('.')) return isBlockedIPv4(norm.slice(7));
    return false;
}

function isBlockedIP(ip) {
    if (!ip || typeof ip !== 'string') return true;
    return ip.includes(':') ? isBlockedIPv6(ip.trim()) : isBlockedIPv4(ip.trim());
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
        const records = await dns.lookup(parsed.hostname, { all: true, verbatim: false });
        if (!records.length || records.some((record) => isBlockedIP(record.address))) {
            return { ok: false, error: 'URL resolves to blocked address' };
        }
    } catch {
        return { ok: false, error: 'Could not resolve hostname' };
    }

    return { ok: true, url: parsed.toString() };
}

async function fetchValidatedImage(targetUrl, redirectCount = 0) {
    if (redirectCount > MAX_REDIRECTS) {
        throw Object.assign(new Error('Too many redirects'), { statusCode: 400 });
    }

    const validation = await validateProxyUrl(targetUrl);
    if (!validation.ok) {
        throw Object.assign(new Error(validation.error), { statusCode: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(validation.url, {
            redirect: 'manual',
            signal: controller.signal,
            headers: { Accept: 'image/*' },
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (!location) {
                throw Object.assign(new Error('Redirect missing location'), { statusCode: 400 });
            }
            return fetchValidatedImage(new URL(location, validation.url).toString(), redirectCount + 1);
        }

        if (!response.ok) {
            throw Object.assign(new Error(`Failed to fetch image: ${response.statusText}`), { statusCode: response.status });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            throw Object.assign(new Error('Only image responses are allowed'), { statusCode: 415 });
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_BYTES) {
            throw Object.assign(new Error('Image is too large'), { statusCode: 413 });
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) {
            throw Object.assign(new Error('Image is too large'), { statusCode: 413 });
        }

        return { buffer: Buffer.from(arrayBuffer), contentType };
    } finally {
        clearTimeout(timeout);
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
    if (!rawUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const { buffer, contentType } = await fetchValidatedImage(rawUrl);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Proxy Error:', error);
        const status = Number(error.statusCode) || (error.name === 'AbortError' ? 504 : 500);
        return res.status(status).json({ error: status >= 500 ? 'Internal Server Error' : error.message });
    }
}
