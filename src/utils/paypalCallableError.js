/**
 * Normalize Firebase callable / PayPal errors for user-facing toasts.
 */
export function paypalCallableErrorMessage(error, fallback = 'PayPal checkout failed.') {
  const raw = String(error?.message || error?.customData?.message || '').trim();
  if (!raw) return fallback;

  // "Firebase: foo (functions/failed-precondition)" → "foo"
  const cleaned = raw
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\(functions\/[a-z0-9_-]+\)\s*$/i, '')
    .trim();

  return cleaned || fallback;
}
