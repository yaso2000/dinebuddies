/**
 * Consumer login gate: name + gender + age on Firestore before entering the app.
 * Not re-checked inside Layout during normal usage — see ConsumerAppEntryGate.
 */

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
    if (prevOk && !nextOk) return prev;
    return next;
}

export function shouldSkipConsumerProfileCompletion(profile) {
    if (!profile) return false;
    const roleLc = String(profile.role || '').toLowerCase();
    const accountLc = String(profile.accountType || '').toLowerCase();
    const hasBizInfo =
        profile.businessInfo &&
        typeof profile.businessInfo === 'object' &&
        Object.keys(profile.businessInfo).length > 0;
    return (
        profile.isBusiness ||
        profile.pendingBusinessRegistration ||
        hasBizInfo ||
        ['admin', 'staff', 'support', 'partner', 'business', 'affiliate_agent', 'guest'].includes(roleLc) ||
        accountLc === 'business'
    );
}

/** May this profile enter the consumer app? */
export function canConsumerEnterApp(profile) {
    if (!profile) return false;
    if (shouldSkipConsumerProfileCompletion(profile)) return true;
    return isConsumerProfileComplete(profile);
}
