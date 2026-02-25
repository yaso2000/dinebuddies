/**
 * Unified logic to retrieve a safe avatar URL for a user
 * Checks multiple possible fields and provides a consistent fallback
 */
export const getSafeAvatar = (userData) => {
    if (!userData) return getDefaultAvatar();

    // Candidates in priority order
    const candidates = [
        userData.avatar,
        userData.photoURL,
        userData.photo_url,
        userData.profilePicture,
        userData.businessInfo?.logo,
        userData.businessInfo?.logoImage,
        userData.partnerLogo
    ];

    for (const url of candidates) {
        if (url && typeof url === 'string' && url.length > 10) {
            // Basic validation: must be a URL or data URI
            if (url.startsWith('http') || url.startsWith('data:image')) {
                return url;
            }
        }
    }

    // Default Fallback
    return getDefaultAvatar(userData.display_name || userData.displayName || userData.nickname);
};

/**
 * Returns a consistent default avatar (Initial-based or silhouette)
 */
export const getDefaultAvatar = (name = '') => {
    if (name && name !== 'User' && name !== 'Member') {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        // Using UI Avatars for a clean, initials-based look
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&bold=true&size=150`;
    }

    // Elegant silhouette SVG as the absolute base fallback
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E';
};
