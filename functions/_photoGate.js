/**
 * Profile-photo soft gate (server). A user "has a real photo" only when a photo
 * field holds an uploaded image or an OAuth account photo — NOT a generated
 * initials/placeholder (ui-avatars / dicebear / inline SVG). Mirrors the client
 * `hasRealProfilePhoto` in src/utils/avatarUtils.js.
 */
function isUploadedPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    // Never count OAuth account photos (Google/Facebook), generated placeholders,
    // or stock defaults — only images the user uploaded into our Storage.
    if (/lh3\.googleusercontent\.com|googleusercontent\.com|graph\.facebook\.com|fbcdn\.net/i.test(u)) return false;
    if (/ui-avatars\.com|dicebear|data:image\/svg|images\.unsplash\.com/i.test(u)) return false;
    if (/firebasestorage\.googleapis\.com|firebasestorage\.app|\.appspot\.com\/o\/|\/v0\/b\/[^/]+\/o\//i.test(u)) return true;
    if (/^data:image\//i.test(u)) return true; // inline uploaded image (non-svg, excluded above)
    return false;
}

function docHasRealPhoto(userData) {
    if (!userData || typeof userData !== 'object') return false;
    const candidates = [
        userData.photoURL,
        userData.photo_url,
        userData.avatar,
        userData.avatarUrl,
        userData.avatar_url,
    ];
    return candidates.some((url) => isUploadedPhotoUrl(url));
}

module.exports = { docHasRealPhoto };
