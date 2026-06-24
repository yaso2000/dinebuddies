import { peekOAuthRedirectProvider } from './localDevAuth';

/** @returns {'google' | 'apple' | 'facebook' | null} */
export function oauthProviderIdToAuthProvider(providerId) {
    if (providerId === 'apple.com') return 'apple';
    if (providerId === 'google.com') return 'google';
    if (providerId === 'facebook.com') return 'facebook';
    return null;
}

export function isKnownOAuthProviderId(providerId) {
    return oauthProviderIdToAuthProvider(providerId) != null;
}

/**
 * Resolve OAuth provider id after redirect — Apple/Safari often omit providerData until reload.
 */
export async function resolveRedirectProviderId(user, result) {
    const stashed = peekOAuthRedirectProvider();
    let pid =
        stashed ||
        result?.providerId ||
        user?.providerData?.[0]?.providerId ||
        null;
    if (pid) return pid;
    if (!user?.reload) {
        if (peekOAuthRedirectPending() && stashed === 'apple.com') return 'apple.com';
        if (peekOAuthRedirectPending()) return peekOAuthRedirectProvider() || 'apple.com';
        return null;
    }
    try {
        await user.reload();
    } catch {
        /* ignore */
    }
    pid = user?.providerData?.[0]?.providerId || peekOAuthRedirectProvider() || null;
    if (pid) return pid;
    if (peekOAuthRedirectPending()) {
        return peekOAuthRedirectProvider() || 'apple.com';
    }
    return null;
}
