const STORAGE_KEY = 'dinebuddies:communityChatBannerLocal';

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
    map[prefKey(userId, partnerId)] = Boolean(visible);
    writeMap(map);
}
