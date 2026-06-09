import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;

function ipv4ToInt(ip) {
    return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIpv4(ip) {
    const n = ipv4ToInt(ip);
    const ranges = [
        ['0.0.0.0', 8],
        ['10.0.0.0', 8],
        ['127.0.0.0', 8],
        ['169.254.0.0', 16],
        ['172.16.0.0', 12],
        ['192.168.0.0', 16],
        ['100.64.0.0', 10],
        ['192.0.0.0', 24],
        ['198.18.0.0', 15],
        ['224.0.0.0', 4],
    ];
    return ranges.some(([base, bits]) => {
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        return (n & mask) === (ipv4ToInt(base) & mask);
    });
}

export function isPrivateAddress(address) {
    const ipType = net.isIP(address);
    if (ipType === 4) return isPrivateIpv4(address);
    if (ipType === 6) {
        const normalized = address.toLowerCase();
        return normalized === '::1' ||
            normalized === '::' ||
            normalized.startsWith('fc') ||
            normalized.startsWith('fd') ||
            normalized.startsWith('fe80:') ||
            normalized.startsWith('::ffff:127.') ||
            normalized.startsWith('::ffff:10.') ||
            normalized.startsWith('::ffff:192.168.');
    }
    return false;
}

async function assertPublicHttpUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http(s) URLs are allowed');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Localhost URLs are not allowed');
    }
    if (net.isIP(hostname)) {
        if (isPrivateAddress(hostname)) throw new Error('Private IP URLs are not allowed');
        return parsed;
    }
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
        throw new Error('Private network URLs are not allowed');
    }
    return parsed;
}

async function fetchPublicUrl(rawUrl, redirects = 0) {
    const parsed = await assertPublicHttpUrl(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(parsed.toString(), {
            redirect: 'manual',
            signal: controller.signal
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects');
            const location = response.headers.get('location');
            if (!location) throw new Error('Redirect missing location');
            return fetchPublicUrl(new URL(location, parsed).toString(), redirects + 1);
        }
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

async function readLimitedResponse(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
        throw new Error('Response too large');
    }
    const reader = response.body?.getReader();
    if (!reader) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) throw new Error('Response too large');
        return Buffer.from(arrayBuffer);
    }

    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            throw new Error('Response too large');
        }
        chunks.push(Buffer.from(value));
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

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const rawUrl = Array.isArray(url) ? url[0] : url;
        const response = await fetchPublicUrl(rawUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
            return res.status(415).json({ error: 'Only image responses are allowed' });
        }
        if (contentType) res.setHeader('Content-Type', contentType);

        const buffer = await readLimitedResponse(response);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(400).json({ error: 'Unable to proxy this URL' });
    }
}
