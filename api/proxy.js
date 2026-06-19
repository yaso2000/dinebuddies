import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

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

function isPrivateIp(ip) {
    const normalized = String(ip || '').toLowerCase();
    if (net.isIPv4(normalized)) return isPrivateIPv4(normalized);
    if (!net.isIPv6(normalized)) return true;
    if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('::ffff:')) {
        return isPrivateIPv4(normalized.slice('::ffff:'.length));
    }
    return false;
}

export async function assertPublicUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Only http(s) URLs are allowed');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === 'metadata.google.internal'
    ) {
        throw new Error('Private hosts are not allowed');
    }

    const addresses = net.isIP(hostname)
        ? [{ address: hostname }]
        : await dns.lookup(hostname, { all: true, verbatim: false });
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
        throw new Error('Private network targets are not allowed');
    }
    return parsed;
}

export async function fetchChecked(rawUrl, redirectsRemaining = MAX_REDIRECTS) {
    const parsed = await assertPublicUrl(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(parsed.toString(), {
            redirect: 'manual',
            signal: controller.signal,
            headers: { Accept: 'image/*' },
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (redirectsRemaining <= 0) throw new Error('Too many redirects');
            const location = response.headers.get('location');
            if (!location) throw new Error('Redirect missing location');
            return fetchChecked(new URL(location, parsed).toString(), redirectsRemaining - 1);
        }

        return response;
    } finally {
        clearTimeout(timeout);
    }
}

export async function readLimited(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
        throw new Error('Image is too large');
    }
    if (!response.body) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_BYTES) throw new Error('Image is too large');
        return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            throw new Error('Image is too large');
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
        const rawUrl = Array.isArray(url) ? url[0] : url;
        const response = await fetchChecked(rawUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }
        if (contentType) res.setHeader('Content-Type', contentType);

        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const buffer = await readLimited(response);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(400).json({ error: 'Invalid image URL' });
    }
}
