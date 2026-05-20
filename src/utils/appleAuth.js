import { getAdditionalUserInfo } from 'firebase/auth';

/**
 * Apple often omits displayName on the Firebase user; name is only in additionalUserInfo on first sign-in.
 */
export function resolveAppleDisplayName(firebaseUser, authResult) {
    const fromUser = firebaseUser?.displayName?.trim();
    if (fromUser) return fromUser;

    if (!authResult) return null;
    const profile = getAdditionalUserInfo(authResult)?.profile;
    if (!profile || typeof profile !== 'object') return null;

    const given = profile.given_name ?? profile.givenName;
    const family = profile.family_name ?? profile.familyName;
    if (given || family) {
        return [given, family].filter(Boolean).join(' ').trim() || null;
    }

    const name = profile.name;
    if (name && typeof name === 'object') {
        const first = name.firstName ?? name.first;
        const last = name.lastName ?? name.last;
        if (first || last) {
            return [first, last].filter(Boolean).join(' ').trim() || null;
        }
    }

    return null;
}
