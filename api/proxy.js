import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const METADATA_HOSTS = new Set([
    'metadata.google.internal',
    '169.254.169.254',
]);

function isBlockedHostname(hostname) {
    const h = String(hostname || '').trim().toLowerCase();
    return !h || h === 'localhost' || h.endsWith('.localhost') || METADATA_HOSTS.has(h);
}

function isPrivateIpv4(ip) {
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
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

function isPrivateIpv6(ip) {
    const normalized = ip.toLowerCase();
    return (
        normalized === '::1' ||
        normalized === '::' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:') ||
        normalized.startsWith('::ffff:127.') ||
        normalized.startsWith('::ffff:10.') ||
        normalized.startsWith('::ffff:169.254.') ||
        normalized.startsWith('::ffff:192.168.')
    );
}

function isBlockedIp(ip) {
    const version = net.isIP(ip);
    if (version === 4) return isPrivateIpv4(ip);
    if (version === 6) return isPrivateIpv6(ip);
    return true;
}

export async function validateProxyUrl(rawUrl) {
    const parsed = new URL(String(rawUrl || ''));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http and https URLs are allowed');
    }
    if (parsed.username || parsed.password || isBlockedHostname(parsed.hostname)) {
        throw new Error('Blocked proxy target');
    }

    const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isBlockedIp(record.address))) {
        throw new Error('Blocked proxy target');
    }
    return parsed;
}

async function fetchValidatedUrl(url, redirectsRemaining = MAX_REDIRECTS) {
    const parsed = await validateProxyUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(parsed.toString(), {
            redirect: 'manual',
            signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            if (redirectsRemaining <= 0) {
                throw new Error('Too many redirects');
            }
            const nextUrl = new URL(response.headers.get('location'), parsed);
            return fetchValidatedUrl(nextUrl.toString(), redirectsRemaining - 1);
        }

        return response;
    } finally {
        clearTimeout(timeout);
    }
}

async function readCappedResponse(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
        throw new Error('Response too large');
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_BYTES) {
            throw new Error('Response too large');
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks);
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

    const rawUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
    if (!rawUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchValidatedUrl(rawUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const buffer = await readCappedResponse(response);
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(400).json({ error: 'Invalid proxy target' });
    }
}
