import dns from 'node:dns';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isBlockedIp(address) {
    if (!address) return true;
    if (address === '0.0.0.0' || address === '::') return true;
    if (address === '169.254.169.254') return true;
    if (address.startsWith('127.')) return true;
    if (address.startsWith('10.')) return true;
    if (address.startsWith('192.168.')) return true;
    const parts = address.split('.').map(Number);
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    }
    const normalized = address.toLowerCase();
    return normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:');
}

async function validateProxyUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || ''));
    } catch {
        throw new Error('Invalid url parameter');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only http and https URLs are allowed');
    }
    if (parsed.username || parsed.password) {
        throw new Error('URLs with embedded credentials are not allowed');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
        throw new Error('Blocked proxy hostname');
    }

    if (net.isIP(hostname)) {
        if (isBlockedIp(hostname)) throw new Error('Blocked proxy address');
        return parsed;
    }

    const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: false });
    if (!addresses.length || addresses.some((entry) => isBlockedIp(entry.address))) {
        throw new Error('Blocked proxy address');
    }
    return parsed;
}

async function fetchWithValidation(rawUrl, redirectCount = 0) {
    if (redirectCount > MAX_REDIRECTS) {
        throw new Error('Too many redirects');
    }

    const parsed = await validateProxyUrl(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(parsed.toString(), {
            redirect: 'manual',
            signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) throw new Error('Redirect without location');
            const nextUrl = new URL(location, parsed).toString();
            return fetchWithValidation(nextUrl, redirectCount + 1);
        }

        return response;
    } finally {
        clearTimeout(timeout);
    }
}

async function readCappedBody(response) {
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
        throw new Error('Proxy response too large');
    }

    const reader = response.body?.getReader?.();
    if (!reader) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) throw new Error('Proxy response too large');
        return Buffer.from(arrayBuffer);
    }

    const chunks = [];
    let total = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            throw new Error('Proxy response too large');
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
}

export { validateProxyUrl, isBlockedIp };

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchWithValidation(url);

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

        const buffer = await readCappedBody(response);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(400).json({ error: 'Proxy request rejected', details: error.message });
    }
}
