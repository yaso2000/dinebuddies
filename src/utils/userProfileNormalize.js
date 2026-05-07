/**
 * Same rules as AuthContext profile listener — single source for “is this a business account?”
 * Use when reading users/{uid} outside AuthContext (e.g. BusinessProfile onSnapshot on raw doc data).
 */
export function normalizeUserProfile(data) {
    if (!data) return null;
    const roleLc = String(data.role || '').toLowerCase();
    const accountTypeLc = String(data.accountType || '').toLowerCase();
    const hasBusinessInfoDoc =
        data.businessInfo &&
        typeof data.businessInfo === 'object' &&
        Object.keys(data.businessInfo).length > 0;
    const isBusinessDoc =
        roleLc === 'business' ||
        roleLc === 'partner' ||
        accountTypeLc === 'business' ||
        hasBusinessInfoDoc;
    const isGuestProfile = roleLc === 'guest' || data.isGuest === true;
    const regIntentLc = String(data.registrationIntent || '').toLowerCase();
    /** Firestore flag from email business signup (main.jsx) — must not be lost when role is already `business`. */
    const pendingFromFirestore = data.pendingBusinessRegistration === true;
    const pendingFromIntent =
        regIntentLc === 'business' &&
        !hasBusinessInfoDoc &&
        roleLc !== 'business' &&
        roleLc !== 'partner';
    const pendingBusinessRegistration = pendingFromFirestore || pendingFromIntent;
    const isBusiness = isBusinessDoc || pendingBusinessRegistration;
    return {
        ...data,
        id: data.id || data.uid || '',
        uid: data.uid || data.id || '',
        displayName: data.displayName || data.display_name || data.nickname || '',
        display_name: data.display_name || data.displayName || data.nickname || '',
        photoURL: data.photoURL || data.photo_url || data.avatar || '',
        photo_url: data.photo_url || data.photoURL || data.avatar || '',
        isBusiness,
        isGuest: isGuestProfile,
        pendingBusinessRegistration,
        role: isGuestProfile
            ? 'guest'
            : (isBusinessDoc || pendingBusinessRegistration)
                ? 'business'
                : (data.role || 'user'),
        isProfileComplete: isGuestProfile
            ? true
            : pendingBusinessRegistration
                ? false
                : isBusiness
                    ? true
                    : data.isProfileComplete === true || (
                        (data.displayName || data.display_name || data.nickname) &&
                        data.gender &&
                        (data.ageCategory || data.age)
                    )
    };
}
