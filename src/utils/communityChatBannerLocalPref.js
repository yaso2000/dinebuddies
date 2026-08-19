const STORAGE_KEY = 'dinebuddies:communityChatBannerLocal';
// One entry per userId:partnerId room ever visited — cap it so this doesn't
// grow unbounded in localStorage over a long-lived session across many rooms.
const MAX_ENTRIES = 100;

function readMap() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeMap(map) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* quota / private mode */
    }
}

function prefKey(userId, partnerId) {
    return `${userId}:${partnerId}`;
}

/** Guest/member personal banner visibility (default on). Host global setting is separate. */
export function readGuestCommunityBannerVisible(userId, partnerId) {
    if (!userId || !partnerId) return true;
    const value = readMap()[prefKey(userId, partnerId)];
    return value !== false;
}

export function writeGuestCommunityBannerVisible(userId, partnerId, visible) {
    if (!userId || !partnerId) return;
    const map = readMap();
    const key = prefKey(userId, partnerId);
    // Re-inserting moves this key to the end (most-recently-used) so eviction
    // below drops the room this device visited longest ago, not this one.
    delete map[key];
    map[key] = Boolean(visible);
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
        for (const staleKey of keys.slice(0, keys.length - MAX_ENTRIES)) {
            delete map[staleKey];
        }
    }
    writeMap(map);
}
