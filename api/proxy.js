import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 8000;
const BLOCKED_HOSTS = new Set([
    'localhost',
    'metadata.google.internal',
    '169.254.169.254',
    'metadata',
]);

function isPrivateIPv4(ip) {
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
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );
}

function isPrivateIPv6(ip) {
    const value = ip.toLowerCase();
    return (
        value === '::' ||
        value === '::1' ||
        value.startsWith('fc') ||
        value.startsWith('fd') ||
        value.startsWith('fe80:') ||
        value.startsWith('::ffff:127.') ||
        value.startsWith('::ffff:10.') ||
        value.startsWith('::ffff:192.168.') ||
        value.startsWith('::ffff:169.254.')
    );
}

export function isPrivateAddress(address) {
    const ipVersion = net.isIP(address);
    if (ipVersion === 4) return isPrivateIPv4(address);
    if (ipVersion === 6) return isPrivateIPv6(address);
    return true;
}

export async function validateRemoteImageUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw Object.assign(new Error('Invalid url parameter'), { statusCode: 400 });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw Object.assign(new Error('Only http and https URLs are allowed'), { statusCode: 400 });
    }

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.local')) {
        throw Object.assign(new Error('Blocked host'), { statusCode: 400 });
    }

    const literalVersion = net.isIP(hostname);
    const addresses = literalVersion
        ? [{ address: hostname }]
        : await dns.lookup(hostname, { all: true, verbatim: false });

    if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
        throw Object.assign(new Error('Blocked host address'), { statusCode: 400 });
    }

    return parsed.toString();
}

async function fetchWithValidatedRedirects(initialUrl) {
    let currentUrl = await validateRemoteImageUrl(initialUrl);

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(currentUrl, {
                redirect: 'manual',
                signal: controller.signal,
            });

            if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
                const nextUrl = new URL(response.headers.get('location'), currentUrl).toString();
                currentUrl = await validateRemoteImageUrl(nextUrl);
                continue;
            }

            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    throw Object.assign(new Error('Too many redirects'), { statusCode: 400 });
}

async function readLimitedResponse(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
        throw Object.assign(new Error('Image is too large'), { statusCode: 413 });
    }

    if (!response.body?.getReader) {
        const fallbackBuffer = Buffer.from(await response.arrayBuffer());
        if (fallbackBuffer.length > MAX_BYTES) {
            throw Object.assign(new Error('Image is too large'), { statusCode: 413 });
        }
        return fallbackBuffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            throw Object.assign(new Error('Image is too large'), { statusCode: 413 });
        }
        chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
}

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetchWithValidatedRedirects(Array.isArray(url) ? url[0] : url);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses can be proxied' });
        }
        res.setHeader('Content-Type', contentType);

        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const buffer = await readLimitedResponse(response);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        const statusCode = error.statusCode || (error.name === 'AbortError' ? 504 : 500);
        res.status(statusCode).json({ error: statusCode === 500 ? 'Internal Server Error' : error.message });
    }
}
