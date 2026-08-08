/** Normalize venue address for exact equality checks (Google ↔ DineBuddies). */
export function normalizeVenueAddress(raw) {
  return String(raw || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.,،؛:'"()`\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exact geo match — same coordinates when rounded (default 5 decimals ≈ 1.1 m). */
export function coordsExactMatch(lat1, lng1, lat2, lng2, decimals = 5) {
  const aLat = Number(lat1);
  const aLng = Number(lng1);
  const bLat = Number(lat2);
  const bLng = Number(lng2);
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return false;
  const round = (n) => Number(n.toFixed(decimals));
  return round(aLat) === round(bLat) && round(aLng) === round(bLng);
}
