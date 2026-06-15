import dns from 'dns/promises';

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
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
    return false;
}

function isBlockedIPv6(ip) {
    const norm = ip.toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fe80:') || norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('ff')) return true;
    if (norm.startsWith('::ffff:') && norm.length > 7) {
        const v4 = norm.slice(7);
        if (v4.includes('.')) return isBlockedIPv4(v4);
    }
    return false;
}

function isBlockedIP(ip) {
    if (!ip || typeof ip !== 'string') return true;
    const trimmed = ip.trim();
    return trimmed.includes(':') ? isBlockedIPv6(trimmed) : isBlockedIPv4(trimmed);
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

    const hostname = parsed.hostname;
    if (!hostname || isBlockedHostname(hostname)) {
        return { ok: false, error: 'URL hostname not allowed' };
    }

    try {
        const addresses = await dns.lookup(hostname, { all: true, family: 0 });
        if (!addresses.length || addresses.some(({ address }) => isBlockedIP(address))) {
            return { ok: false, error: 'URL resolves to blocked address' };
        }
    } catch {
        return { ok: false, error: 'Could not resolve hostname' };
    }

    return { ok: true, url: parsed.toString() };
}

export async function fetchWithValidatedRedirects(targetUrl, opts = {}) {
    let currentUrl = targetUrl;
    const maxRedirects = opts.maxRedirects ?? 3;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
        const validation = await validateProxyUrl(currentUrl);
        if (!validation.ok) {
            const error = new Error(validation.error);
            error.statusCode = 400;
            throw error;
        }

        const response = await fetch(validation.url, {
            signal: opts.signal,
            redirect: 'manual',
            headers: {
                'User-Agent': 'DineBuddiesImageProxy/1.0',
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) return response;
            currentUrl = new URL(location, validation.url).toString();
            continue;
        }

        return response;
    }

    const error = new Error('Too many redirects');
    error.statusCode = 400;
    throw error;
}

export async function readBodyWithLimit(response, maxBytes) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        const error = new Error('Response too large');
        error.statusCode = 413;
        throw error;
    }

    if (!response.body?.getReader) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) {
            const error = new Error('Response too large');
            error.statusCode = 413;
            throw error;
        }
        return Buffer.from(arrayBuffer);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            const error = new Error('Response too large');
            error.statusCode = 413;
            throw error;
        }
        chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
}
