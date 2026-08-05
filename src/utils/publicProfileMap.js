/**
 * Maps Firestore public_profiles/{uid} document data to the loose "user" shape
 * used by PostCard, StoriesBar, and similar UI (displayName, avatars, role).
 */
export function mapPublicProfileDocToUserShape(p) {
    if (!p || typeof p !== 'object') return null;
    const isBiz = p.profileType === 'business';
    const name = p.displayName || 'User';
    const av = p.avatarUrl || null;
    return {
        displayName: name,
        display_name: name,
        name,
        photo_url: av,
        photoURL: av,
        avatarUrl: av,
        avatar: av,
        role: isBiz ? 'business' : 'user',
        isGuest: p.isGuest === true,
        subscriptionTier: (p.subscriptionTier || 'free').toString().toLowerCase(),
        businessInfo: isBiz && p.businessPublic
            ? { businessName: name, ...p.businessPublic }
            : undefined
    };
}
