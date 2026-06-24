import { dismissFacebookSdkOverlay } from './facebookSdkCleanup';
import { clearOAuthRedirectPending, isIosTouchDevice } from './localDevAuth';

/** Meta app id — same as Firebase Facebook provider. */
const FB_APP_ID = '1718617005774108';
const FB_IOS_LOGIN_KEY = 'dineb_fb_ios_login';

function loadFacebookSDK() {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('Facebook login requires a browser'));
            return;
        }
        if (window.FB) {
            resolve(window.FB);
            return;
        }
        const existing = document.getElementById('facebook-jssdk');
        if (!existing) {
            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
            document.head.appendChild(script);
        }
        window.fbAsyncInit = () => {
            try {
                window.FB.init({
                    appId: FB_APP_ID,
                    version: 'v19.0',
                    cookie: true,
                    xfbml: false,
                });
                resolve(window.FB);
            } catch (err) {
                reject(err);
            }
        };
    });
}

function readFacebookAccessToken(FB) {
    return new Promise((resolve) => {
        try {
            FB.getLoginStatus((response) => {
                if (response?.status === 'connected' && response.authResponse?.accessToken) {
                    resolve(response.authResponse.accessToken);
                    return;
                }
                resolve(null);
            });
        } catch {
            resolve(null);
        }
    });
}

export function peekFacebookIosLoginPending() {
    if (!isIosTouchDevice()) return false;
    try {
        return sessionStorage.getItem(FB_IOS_LOGIN_KEY) === '1';
    } catch {
        return false;
    }
}

export function markFacebookIosLoginPending() {
    try {
        sessionStorage.setItem(FB_IOS_LOGIN_KEY, '1');
    } catch {
        /* ignore */
    }
}

export function clearFacebookIosLoginPending() {
    try {
        sessionStorage.removeItem(FB_IOS_LOGIN_KEY);
    } catch {
        /* ignore */
    }
}

/** iPhone/iPad only — Meta SDK redirect + token (not Firebase popup/redirect). */
export function shouldUseFacebookIosSdk() {
    return isIosTouchDevice();
}

/**
 * After Meta redirect back to /login, read access token.
 * @returns {Promise<string | null>}
 */
export async function completeFacebookIosRedirectReturn() {
    if (!shouldUseFacebookIosSdk() || !peekFacebookIosLoginPending()) {
        return null;
    }
    clearOAuthRedirectPending();
    try {
        const FB = await loadFacebookSDK();
        const token = await readFacebookAccessToken(FB);
        clearFacebookIosLoginPending();
        dismissFacebookSdkOverlay();
        return token;
    } catch {
        clearFacebookIosLoginPending();
        dismissFacebookSdkOverlay();
        return null;
    }
}

/**
 * Start Facebook login on iOS — Safari leaves the page (Meta redirect).
 * Completion happens on return via completeFacebookIosRedirectReturn().
 */
export async function startFacebookIosRedirectLogin() {
    if (!shouldUseFacebookIosSdk()) {
        const err = new Error('Facebook iOS SDK login called on non-iOS device');
        err.code = 'auth/operation-not-allowed';
        throw err;
    }
    clearOAuthRedirectPending();
    dismissFacebookSdkOverlay();
    markFacebookIosLoginPending();

    const FB = await loadFacebookSDK();

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            dismissFacebookSdkOverlay();
            fn(value);
        };

        const timer = setTimeout(() => {
            clearFacebookIosLoginPending();
            finish(reject, Object.assign(new Error('Facebook login timed out.'), {
                code: 'auth/popup-closed-by-user',
            }));
        }, 120000);

        FB.login(
            (response) => {
                if (response?.status === 'connected' && response.authResponse?.accessToken) {
                    clearFacebookIosLoginPending();
                    finish(resolve, response.authResponse.accessToken);
                    return;
                }
                if (response?.status === 'unknown' || !response.authResponse) {
                    clearFacebookIosLoginPending();
                    finish(reject, Object.assign(new Error('Facebook login was cancelled.'), {
                        code: 'auth/popup-closed-by-user',
                    }));
                    return;
                }
                clearFacebookIosLoginPending();
                finish(reject, new Error(`Facebook login failed: ${response.status}`));
            },
            { scope: 'email,public_profile' }
        );
    });
}
