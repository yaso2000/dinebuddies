/**
 * Profile-photo soft gate (server). A user "has a real photo" only when a photo
 * field holds an uploaded image or an OAuth account photo — NOT a generated
 * initials/placeholder (ui-avatars / dicebear / inline SVG). Mirrors the client
 * `hasRealProfilePhoto` in src/utils/avatarUtils.js.
 */
function docHasRealPhoto(userData) {
    if (!userData || typeof userData !== 'object') return false;
    const candidates = [
        userData.photoURL,
        userData.photo_url,
        userData.avatar,
        userData.avatarUrl,
        userData.avatar_url,
    ];
    return candidates.some((url) => {
        if (!url || typeof url !== 'string') return false;
        if (/ui-avatars\.com|dicebear|data:image\/svg/i.test(url)) return false; // generated placeholder
        return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
    });
}

module.exports = { docHasRealPhoto };
