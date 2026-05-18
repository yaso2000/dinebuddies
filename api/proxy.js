import dns from 'dns';
import net from 'net';

const dnsLookup = dns.promises.lookup.bind(dns.promises);
const MAX_PROXY_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
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
    if (a === 127 || a === 10 || a === 0) return true;
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
    if (norm.startsWith('fc') || norm.startsWith('fd') || norm.startsWith('ff')) return true;
    if (norm.startsWith('::ffff:') && norm.includes('.')) return isBlockedIPv4(norm.slice(7));
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
    if (isBlockedHostname(parsed.hostname)) {
        return { ok: false, error: 'URL hostname not allowed' };
    }

    const literalVersion = net.isIP(parsed.hostname);
    if (literalVersion) {
        return isBlockedIP(parsed.hostname)
            ? { ok: false, error: 'URL address not allowed' }
            : { ok: true, parsed };
    }

    try {
        const results = await dnsLookup(parsed.hostname, { all: true, verbatim: false });
        if (!results.length || results.some((result) => isBlockedIP(result.address))) {
            return { ok: false, error: 'URL resolves to blocked address' };
        }
        return { ok: true, parsed };
    } catch {
        return { ok: false, error: 'Could not resolve hostname' };
    }
}

async function fetchValidatedUrl(startUrl) {
    let currentUrl = startUrl;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const validation = await validateProxyUrl(currentUrl);
        if (!validation.ok) {
            const error = new Error(validation.error);
            error.statusCode = 400;
            throw error;
        }

        const response = await fetch(currentUrl, { redirect: 'manual' });
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            currentUrl = new URL(response.headers.get('location'), validation.parsed).toString();
            continue;
        }
        return response;
    }

    const error = new Error('Too many redirects');
    error.statusCode = 400;
    throw error;
}

async function readResponseBuffer(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_PROXY_BYTES) {
        const error = new Error('Response too large');
        error.statusCode = 413;
        throw error;
    }

    const chunks = [];
    let total = 0;
    const reader = response.body?.getReader?.();
    if (!reader) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_PROXY_BYTES) {
            const error = new Error('Response too large');
            error.statusCode = 413;
            throw error;
        }
        return buffer;
    }

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_PROXY_BYTES) {
            const error = new Error('Response too large');
            error.statusCode = 413;
            throw error;
        }
        chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
}

export default async function handler(req, res) {
    const { url } = req.query;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const targetUrl = Array.isArray(url) ? url[0] : url;
        const response = await fetchValidatedUrl(targetUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        // Forward Content-Type
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Return image data
        const buffer = await readResponseBuffer(response);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Internal Server Error' });
    }
}
