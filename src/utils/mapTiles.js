/**
 * Base map tiles — Esri Dark/Light Gray Canvas (free, no API key required).
 *
 * Kept in one place so swapping the basemap provider (or adding a keyed
 * provider later) touches a single file instead of every map component.
 * Replaces CARTO basemaps, which began requiring an API key.
 */
export const ESRI_DARK_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
export const ESRI_LIGHT_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
export const ESRI_TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
// Esri Gray Canvas basemaps are published up to zoom level 16.
export const ESRI_TILE_MAX_ZOOM = 16;

/** Tile URL template for the given theme. */
export function baseTileUrl(isDark = true) {
  return isDark ? ESRI_DARK_TILES : ESRI_LIGHT_TILES;
}

/**
 * Create the base tile layer and attach it to a Leaflet map.
 * @param {object} L - the Leaflet namespace
 * @param {object} map - the Leaflet map instance
 * @param {boolean} isDark - dark theme when true (default), light when false
 * @returns the created tile layer
 */
export function addBaseTileLayer(L, map, isDark = true) {
  return L.tileLayer(baseTileUrl(isDark), {
    attribution: ESRI_TILE_ATTRIBUTION,
    maxZoom: ESRI_TILE_MAX_ZOOM,
  }).addTo(map);
}
