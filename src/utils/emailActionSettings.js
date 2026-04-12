/**
 * Firebase Auth email actions (verification, etc.) accept ActionCodeSettings.
 * `url` becomes `continueUrl` in the link and must use an authorized domain
 * (Firebase Console → Authentication → Settings → Authorized domains).
 *
 * For the verification link to open YOUR app instead of the default Firebase page,
 * set Authentication → Templates → Email address verification → Action URL to:
 *   {origin}/auth/action
 * (same path as VITE_PUBLIC_APP_URL or current origin in dev).
 */

export function getAppOriginForEmailActions() {
    if (typeof window === 'undefined') return '';
    const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL;
    if (fromEnv && String(fromEnv).trim().startsWith('http')) {
        try {
            return new URL(String(fromEnv).trim()).origin;
        } catch {
            /* fall through */
        }
    }
    return window.location.origin;
}

/** Continue URL after email verification — sign in again on unified business login. */
export function businessEmailVerificationActionSettings() {
    const origin = getAppOriginForEmailActions();
    return {
        url: `${origin}/business/login?fromVerify=1`,
        handleCodeInApp: false,
    };
}

export function businessLoginEmailVerificationActionSettings() {
    const origin = getAppOriginForEmailActions();
    return {
        url: `${origin}/business/login`,
        handleCodeInApp: false,
    };
}
