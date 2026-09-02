/**
 * Owner-only "act as region" state.
 *
 * The super owner / full admin can preview the panel exactly as a regional
 * manager sees it. When a region is selected here, the admin API layer stamps
 * `viewAsRegion` onto every callable payload; the server honors it ONLY for
 * full admins (a regional_manager stays locked to their own region regardless),
 * so this can never widen anyone's access — it only narrows the owner's view.
 *
 * State is module-level + persisted per-browser so it survives navigation
 * between admin pages. It never leaves the owner's own device.
 */
import { ADMIN_REGIONS } from '../utils/adminAccess';

const STORAGE_KEY = 'db_admin_view_as_region';

let current = '';
try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ADMIN_REGIONS[saved]) current = saved;
} catch {
    /* storage unavailable — default to global view */
}

const listeners = new Set();

/** Current region key the owner is acting as, or '' for the global (unscoped) view. */
export function getViewAsRegion() {
    return current;
}

/** Set (or clear, with a falsy value) the acting region. Notifies subscribers. */
export function setViewAsRegion(regionKey) {
    const next = regionKey && ADMIN_REGIONS[regionKey] ? regionKey : '';
    if (next === current) return;
    current = next;
    try {
        if (current) localStorage.setItem(STORAGE_KEY, current);
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
    listeners.forEach((fn) => {
        try {
            fn(current);
        } catch {
            /* ignore */
        }
    });
}

/** Subscribe to changes; returns an unsubscribe fn. */
export function subscribeViewAsRegion(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Merge the acting region into a callable payload (no-op when viewing globally). */
export function withViewAsRegion(payload) {
    if (!current) return payload || {};
    return { ...(payload || {}), viewAsRegion: current };
}
