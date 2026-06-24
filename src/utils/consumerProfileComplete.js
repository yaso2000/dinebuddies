/**
 * Consumer login gate: name + gender + age on Firestore before entering the app.
 * Business / partner accounts never use this flow — see shouldSkipConsumerProfileCompletion.
 */

import { accountKindFromProfileData, AUTH_PORTAL } from './authPortalGate';
import { mergeProfileSnapshot } from './profileGallery';

export function isConsumerProfileComplete(profile) {
    if (!profile) return false;
    if (profile.isProfileComplete === true) return true;
    const name = profile.displayName || profile.display_name || profile.nickname;
    const age =
        profile.ageCategory ||
        profile.age_category ||
        (typeof profile.age === 'string' ? profile.age : '') ||
        (typeof profile.age === 'number' && profile.age > 0 ? String(profile.age) : '');
    return Boolean(name && profile.gender && age);
}

export function mergeConsumerProfiles(prev, next) {
    if (!next) return prev ?? null;
    if (!prev) return next;
    if (shouldSkipConsumerProfileCompletion(next)) return next;
    if (shouldSkipConsumerProfileCompletion(prev)) return prev;
    const prevOk = prev.isProfileComplete === true || isConsumerProfileComplete(prev);
    const nextOk = next.isProfileComplete === true || isConsumerProfileComplete(next);
    if (prevOk && !nextOk) {
        return mergeProfileSnapshot(prev, { ...prev, ...next, isProfileComplete: prev.isProfileComplete });
    }
    return next;
}

export function shouldSkipConsumerProfileCompletion(profile) {
    if (!profile) return false;
    if (profile.isBusiness === true || profile.pendingBusinessRegistration === true) return true;
    const kind = accountKindFromProfileData(profile);
    if (kind === AUTH_PORTAL.BUSINESS || kind === AUTH_PORTAL.AFFILIATE) return true;
    const roleLc = String(profile.role || '').toLowerCase();
    if (['admin', 'staff', 'support', 'guest'].includes(roleLc)) return true;
    if (String(profile.registrationIntent || '').toLowerCase() === 'business') return true;
    return false;
}

/** May this profile enter the consumer app? */
export function canConsumerEnterApp(profile) {
    if (!profile) return false;
    if (shouldSkipConsumerProfileCompletion(profile)) return true;
    return isConsumerProfileComplete(profile);
}

/** Raw Firestore `users/{uid}` — same skip rules before profile is normalized in AuthContext. */
export function shouldSkipConsumerProfileCompletionFromUserDoc(data) {
    if (!data || typeof data !== 'object') return false;
    return shouldSkipConsumerProfileCompletion(data);
}
