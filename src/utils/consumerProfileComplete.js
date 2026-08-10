/**
 * Consumer login gate: name + gender + age on Firestore before entering the app.
 * Business / partner accounts never use this flow — see shouldSkipConsumerProfileCompletion.
 */

import { accountKindFromProfileData, AUTH_PORTAL } from './authPortalGate';
import { mergeProfileSnapshot } from './profileGallery';

function consumerEntryOkStorageKey(uid) {
    return `dineb_consumer_entry_ok_${uid}`;
}

/** In-memory fallback when Storage is unavailable (tests / private mode). */
const entryOkMemory = new Map();

function storageSet(uid, value) {
    if (!uid) return;
    const key = consumerEntryOkStorageKey(uid);
    entryOkMemory.set(key, value);
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
    try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
}

function storageGet(uid) {
    if (!uid) return false;
    const key = consumerEntryOkStorageKey(uid);
    if (entryOkMemory.get(key) === '1') return true;
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1') {
            entryOkMemory.set(key, '1');
            return true;
        }
    } catch {
        /* ignore */
    }
    // Migrate prior session-only flag so cold starts still benefit after one visit.
    try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === '1') {
            storageSet(uid, '1');
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

function storageClear(uid) {
    if (!uid) return;
    const key = consumerEntryOkStorageKey(uid);
    entryOkMemory.delete(key);
    try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
    try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

/** Remember a confirmed-complete consumer on this device (survives cold start). */
export function markConsumerEntryOk(uid) {
    storageSet(uid, '1');
}

export function hasConsumerEntryOk(uid) {
    return storageGet(uid);
}

export function clearConsumerEntryOk(uid) {
    storageClear(uid);
}

export function isConsumerProfileComplete(profile) {
    if (!profile) return false;
    if (profile.isProfileComplete === true) return true;
    const name = profile.displayName || profile.display_name || profile.nickname;
    const age =
        profile.ageCategory ||
        profile.age_category ||
        (typeof profile.age === 'string' ? profile.age : '') ||
        (typeof profile.age === 'number' && profile.age > 0 ? String(profile.age) : '');
    const hasPhoto = Boolean(
        profile.photoURL || profile.photo_url || profile.avatar || profile.avatarUrl
    );
    return Boolean(name && profile.gender && age && hasPhoto);
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
    if (kind === AUTH_PORTAL.BUSINESS) return true;
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

/**
 * Force /complete-profile only after a server-synced incomplete profile.
 * Early Firestore cache often has OAuth name but missing gender/age — using that
 * to redirect paints the completion form for completed users (flash + hitch).
 * Device entry-ok skips the gate after a prior confirmed-complete load (cold start).
 */
export function shouldForceCompleteProfileRedirect({
    profileServerSynced,
    profile,
    uid,
}) {
    const id = uid || profile?.uid || profile?.id;
    if (id && hasConsumerEntryOk(id)) return false;
    if (!profileServerSynced) return false;
    if (!profile) return false;
    if (canConsumerEnterApp(profile)) {
        if (id) markConsumerEntryOk(id);
        return false;
    }
    return true;
}

/** Raw Firestore `users/{uid}` — same skip rules before profile is normalized in AuthContext. */
export function shouldSkipConsumerProfileCompletionFromUserDoc(data) {
    if (!data || typeof data !== 'object') return false;
    return shouldSkipConsumerProfileCompletion(data);
}
