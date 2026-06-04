/**
 * Leaflet keeps a map instance bound to a DOM node. After SPA navigation the node is
 * replaced while the ref may still point at a detached map — tiles never show.
 */
export function isLeafletMapAttached(mapInstance, containerEl) {
    if (!mapInstance?.current || !containerEl) return false;
    try {
        const mapEl = mapInstance.current.getContainer?.();
        return Boolean(mapEl && containerEl.contains(mapEl));
    } catch {
        return false;
    }
}

export function detachLeafletMap(mapInstance) {
    if (!mapInstance?.current) return;
    try {
        mapInstance.current.remove();
    } catch {
        /* ignore */
    }
    mapInstance.current = null;
}

export function ensureLeafletMapDetachedIfOrphan(mapInstance, containerEl) {
    if (mapInstance?.current && !isLeafletMapAttached(mapInstance, containerEl)) {
        detachLeafletMap(mapInstance);
    }
}
