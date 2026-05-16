/**
 * DineBuddies mark SVGs served from /public.
 * Filenames include spaces — always build URLs with encodeURI for the browser.
 */
function publicSvg(filename) {
    return encodeURI(`/${filename}`);
}

export const APP_LOGO = {
    white: publicSvg('DB-logo white.svg'),
    black: publicSvg('DB-logo black.svg'),
    orange: publicSvg('DB-logo orange.svg'),
};

/** Header / nav / auth chrome: readable on light vs dark UI. */
export function appLogoForChrome(themeMode) {
    return themeMode === 'light' ? APP_LOGO.black : APP_LOGO.white;
}
