const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Opens a validated external web URL. Components should use this boundary
 * instead of calling `window.open` directly when leaving DineBuddies.
 */
export function openExternalUrl(rawUrl) {
  if (typeof window === 'undefined' || !rawUrl) return false;

  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return false;
  }

  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) return false;
  window.open(url.href, '_blank', 'noopener,noreferrer');
  return true;
}
