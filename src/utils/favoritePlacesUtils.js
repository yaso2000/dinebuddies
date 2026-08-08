/** Read `favoritePlaces` from a user/profile object (camelCase or legacy snake_case). */
export function readFavoritePlaces(source) {
    if (!source) return [];
    const raw = source.favoritePlaces ?? source.favorite_places;
    return Array.isArray(raw) ? raw : [];
}

/** Prefer the longest non-stale favorites list across profile sources. */
export function pickFavoritePlaces(...sources) {
    const lists = sources.map(readFavoritePlaces);
    return lists.reduce((best, cur) => (cur.length > best.length ? cur : best), []);
}
export function mergeProfilePreserveFavoritePlaces(prev, incoming) {
    if (!incoming) return prev ?? null;
    if (!prev) return incoming;

    const next = { ...prev, ...incoming };
    const incomingPlaces = readFavoritePlaces(incoming);
    const prevPlaces = readFavoritePlaces(prev);

    if (incomingPlaces.length === 0 && prevPlaces.length > 0) {
        next.favoritePlaces = prevPlaces;
        next.favorite_places = prevPlaces;
    } else if (incomingPlaces.length > 0) {
        next.favoritePlaces = incomingPlaces;
        next.favorite_places = incomingPlaces;
    }

    return next;
}
