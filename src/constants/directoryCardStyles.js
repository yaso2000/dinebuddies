/** Profile-owned preference: which frame style this member uses on directory cards. */

export const DIRECTORY_CARD_STYLE_STORAGE_KEY = 'dinebuddies.directoryCardStyle';

/** @typedef {'hexagon' | 'tilt' | 'circle' | 'halfHex'} DirectoryCardStyleId */

/** @type {DirectoryCardStyleId} */
export const DEFAULT_DIRECTORY_CARD_STYLE = 'circle';

/** Classic circle first — original default directory card. */
export const DIRECTORY_CARD_STYLE_IDS = Object.freeze([
  'circle',
  'hexagon',
  'tilt',
  'halfHex',
]);

/**
 * @param {unknown} value
 * @returns {DirectoryCardStyleId}
 */
export function normalizeDirectoryCardStyleId(value) {
  const id = String(value || '').trim();
  // Legacy: rhombus (diamond) style was removed — map to classic circle.
  if (id === 'rhombus') return 'circle';
  if (DIRECTORY_CARD_STYLE_IDS.includes(/** @type {DirectoryCardStyleId} */ (id))) {
    return /** @type {DirectoryCardStyleId} */ (id);
  }
  return DEFAULT_DIRECTORY_CARD_STYLE;
}
