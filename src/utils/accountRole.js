/**
 * Single source of truth for “is this a business / partner account?” in the client.
 * Keep aligned with AuthContext.normalizeProfile (businessInfo, role casing, accountType).
 */
export function isBusinessUser(profile) {
    if (!profile || typeof profile !== 'object') return false;
    if (profile.isBusiness === true) return true;
    if (profile.pendingBusinessRegistration === true) return true;
    const r = String(profile.role || '').toLowerCase();
    if (r === 'business' || r === 'partner') return true;
    if (String(profile.accountType || '').toLowerCase() === 'business') return true;
    // Firestore stub before step 2 completes (same as normalizeProfile pending business)
    if (String(profile.registrationIntent || '').toLowerCase() === 'business') return true;
    const bi = profile.businessInfo;
    return !!(bi && typeof bi === 'object' && Object.keys(bi).length > 0);
}
