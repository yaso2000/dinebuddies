import { ALL_PLATFORMS } from '../config/deliveryPlatforms';

export const MAX_DELIVERY_LINKS = 5;

const EMPTY_LINK = () => ({
    id: crypto.randomUUID(),
    url: '',
    name: '',
    icon: null,
    color: null,
    gradient: null,
    emoji: null,
});

/** @param {string} host */
function hostMatches(host, pattern) {
    const p = pattern.toLowerCase();
    return host === p || host.endsWith(`.${p}`);
}

/**
 * @param {string} urlString
 * @returns {{ ok: boolean, name?: string, icon?: string|null, color?: string, gradient?: string, emoji?: string, error?: string }}
 */
export function resolveDeliveryLinkFromUrl(urlString) {
    const trimmed = String(urlString || '').trim();
    if (!trimmed) {
        return { ok: false, error: 'empty' };
    }

    let url;
    try {
        url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
        return { ok: false, error: 'invalid_url' };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        return { ok: false, error: 'invalid_url' };
    }

    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    for (const platform of Object.values(ALL_PLATFORMS)) {
        const domains = platform.domains || [];
        if (domains.some((d) => hostMatches(host, d))) {
            return {
                ok: true,
                name: platform.name,
                icon: platform.logo || null,
                color: platform.color,
                gradient: platform.gradient,
                emoji: platform.emoji || '🛵',
            };
        }
    }

    const label = host.split('.')[0] || host;
    const name = label.charAt(0).toUpperCase() + label.slice(1);

    return {
        ok: true,
        name,
        icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
        emoji: '🔗',
    };
}

/** @param {unknown} item */
function normalizeLinkItem(item) {
    if (!item || typeof item !== 'object') return null;
    const url = String(item.url || '').trim();
    if (!url) return null;

    const id = item.id || crypto.randomUUID();
    const name = String(item.name || '').trim();
    const icon = item.icon || null;

    if (name) {
        return {
            id,
            url,
            name,
            icon,
            color: item.color || null,
            gradient: item.gradient || null,
            emoji: item.emoji || null,
        };
    }

    const resolved = resolveDeliveryLinkFromUrl(url);
    if (!resolved.ok) return null;

    return {
        id,
        url,
        name: resolved.name,
        icon: resolved.icon,
        color: resolved.color,
        gradient: resolved.gradient,
        emoji: resolved.emoji,
    };
}

/**
 * Migrate legacy `{ uberEats: url, ... }` or array to normalized list (max 5).
 * @param {unknown} raw
 * @returns {Array<{ id: string, url: string, name: string, icon: string|null, color?: string|null, gradient?: string|null, emoji?: string|null }>}
 */
export function normalizeDeliveryLinks(raw) {
    if (Array.isArray(raw)) {
        return raw.map(normalizeLinkItem).filter(Boolean).slice(0, MAX_DELIVERY_LINKS);
    }

    if (raw && typeof raw === 'object') {
        const items = [];
        for (const [key, url] of Object.entries(raw)) {
            if (!url || typeof url !== 'string') continue;
            const trimmed = url.trim();
            if (!trimmed) continue;

            const platform = ALL_PLATFORMS[key];
            if (platform) {
                items.push({
                    id: crypto.randomUUID(),
                    url: trimmed,
                    name: platform.name,
                    icon: platform.logo || null,
                    color: platform.color,
                    gradient: platform.gradient,
                    emoji: platform.emoji || '🛵',
                });
            } else {
                const resolved = resolveDeliveryLinkFromUrl(trimmed);
                if (resolved.ok) {
                    items.push({
                        id: crypto.randomUUID(),
                        url: trimmed,
                        name: resolved.name,
                        icon: resolved.icon,
                        color: resolved.color,
                        gradient: resolved.gradient,
                        emoji: resolved.emoji,
                    });
                }
            }
        }
        return items.slice(0, MAX_DELIVERY_LINKS);
    }

    return [];
}

/** @returns {Array<{ id: string, url: string, name: string, icon: string|null, color?: string|null, gradient?: string|null, emoji?: string|null }>} */
export function createEmptyDeliveryLinkRow() {
    return EMPTY_LINK();
}

/** @param {Array<{ url?: string, name?: string }>} links */
export function deliveryLinksReadyToSave(links) {
    return (links || []).filter((l) => {
        const url = String(l?.url || '').trim();
        const name = String(l?.name || '').trim();
        return url && name;
    });
}

