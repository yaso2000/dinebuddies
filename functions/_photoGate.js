/**
 * Profile-photo soft gate (server).
 *
 * A user "has a real photo" (a face) when a photo field holds:
 *   - an image uploaded into our Storage (always real, no network needed), OR
 *   - a Google/Facebook OAuth account photo that is an ACTUAL photo — not the
 *     provider's default monogram/silhouette.
 *
 * Google serves a real photo and its no-photo default at the SAME `/a/ACg8oc…`
 * URL shape, so the two can only be told apart by fetching the image: a real
 * photo is a JPEG / larger file; a default is a tiny PNG (~0.8–1.7 KB monogram
 * or silhouette). `classifyRemotePhotoIsReal()` does that fetch once, server-side;
 * the result is cached onto the user/public_profile as `avatarIsRealPhoto`, and
 * the runtime gate `docHasRealPhoto()` reads that cached flag (never fetches).
 * Mirrors the client `hasRealProfilePhoto` in src/utils/avatarUtils.js.
 */
const https = require('https');
const http = require('http');

/** Real photos are JPEG (any size) or a large-enough file; monograms are tiny PNGs. */
const REAL_PHOTO_MIN_BYTES = 3000;

function isGeneratedOrStockUrl(u) {
    return /ui-avatars\.com|dicebear|data:image\/svg|images\.unsplash\.com/i.test(u);
}

/** Image the user uploaded into our Storage (or inline non-svg data image). Always real. */
function isUploadedStorageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const s = url.trim();
    if (isGeneratedOrStockUrl(s)) return false;
    if (/firebasestorage\.googleapis\.com|firebasestorage\.app|\.appspot\.com\/o\/|\/v0\/b\/[^/]+\/o\//i.test(s)) return true;
    if (/^data:image\//i.test(s)) return true;
    return false;
}

/** Google's explicit no-photo default monogram (never a real face). */
function isGoogleDefaultAvatarUrl(url) {
    return /googleusercontent\.com\/a[-/]default/i.test(String(url || ''));
}

/** Google/Facebook OAuth account photo URL (shape only — may still be a provider default). */
function isProviderOAuthPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const s = url.trim();
    if (isGoogleDefaultAvatarUrl(s)) return false;
    if (/lh\d+\.googleusercontent\.com\/a[-/]/i.test(s)) return true;
    if (/graph\.facebook\.com|fbcdn\.net|scontent[^/]*\.facebook\.com|platform-lookaside\.fbsbx\.com/i.test(s)) return true;
    return false;
}

/**
 * Fetch a remote OAuth avatar and decide if it is a real photo (JPEG / large file)
 * rather than a default monogram/silhouette (tiny PNG). Resolves false on any
 * failure — a photo we can't verify does not unlock the gate. Follows redirects
 * (Facebook graph → fbcdn).
 */
function classifyRemotePhotoIsReal(url, redirects = 0) {
    return new Promise((resolve) => {
        if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url) || redirects > 4) {
            return resolve(false);
        }
        const lib = url.startsWith('http://') ? http : https;
        let req;
        try {
            req = lib.get(url, { timeout: 8000 }, (res) => {
                const status = res.statusCode || 0;
                if (status >= 300 && status < 400 && res.headers.location) {
                    res.resume();
                    let next;
                    try { next = new URL(res.headers.location, url).toString(); } catch { return resolve(false); }
                    return resolve(classifyRemotePhotoIsReal(next, redirects + 1));
                }
                if (status !== 200) { res.resume(); return resolve(false); }

                const ctype = String(res.headers['content-type'] || '').toLowerCase();
                const clen = Number(res.headers['content-length']);
                let received = 0;
                let sig = '';
                let done = false;
                const head = [];
                const finish = () => {
                    if (done) return;
                    done = true;
                    const size = Number.isFinite(clen) && clen > 0 ? clen : received;
                    const isJpeg = sig === 'jpeg' || /jpeg|jpg/.test(ctype);
                    resolve(isJpeg || size >= REAL_PHOTO_MIN_BYTES);
                };
                res.on('data', (c) => {
                    received += c.length;
                    if (!sig) {
                        head.push(c);
                        const b = Buffer.concat(head);
                        if (b.length >= 3) {
                            if (b[0] === 0xff && b[1] === 0xd8) sig = 'jpeg';
                            else if (b[0] === 0x89 && b[1] === 0x50) sig = 'png';
                            else if (b.slice(0, 4).toString() === 'RIFF') sig = 'webp';
                            else sig = 'other';
                        }
                    }
                    if (received > 65536) res.destroy(); // enough bytes to judge size
                });
                res.on('end', finish);
                res.on('close', finish);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { try { req.destroy(); } catch { /* noop */ } resolve(false); });
        } catch {
            resolve(false);
        }
    });
}

/**
 * Real-photo signal for a users/public_profiles doc. Uploaded Storage photos are
 * always real; OAuth photos rely on the cached `avatarIsRealPhoto` flag (set by
 * the sync trigger via classifyRemotePhotoIsReal); everything else is false.
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
    if (candidates.some((url) => isUploadedStorageUrl(url))) return true;
    if (candidates.some((url) => isProviderOAuthPhotoUrl(url))) return userData.avatarIsRealPhoto === true;
    return false;
}

/**
 * Compute the real-photo flag for one avatar URL, reusing a cached result when the
 * URL is unchanged. Uploaded photos → true without a fetch; OAuth photos → cached
 * flag or a fresh classify; anything else → false.
 */
async function resolveAvatarIsReal(avatarUrl, cachedUrl, cachedFlag) {
    const url = String(avatarUrl || '').trim();
    if (!url) return false;
    if (isUploadedStorageUrl(url)) return true;
    if (!isProviderOAuthPhotoUrl(url)) return false;
    if (cachedUrl && String(cachedUrl).trim() === url && typeof cachedFlag === 'boolean') return cachedFlag;
    return classifyRemotePhotoIsReal(url);
}

module.exports = {
    docHasRealPhoto,
    classifyRemotePhotoIsReal,
    resolveAvatarIsReal,
    isUploadedStorageUrl,
    isProviderOAuthPhotoUrl,
};
