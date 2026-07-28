import { dismissFacebookSdkOverlay } from './facebookSdkCleanup';
import {
    clearOAuthRedirectPending,
    isAndroidTouchDevice,
    isIosTouchDevice,
} from './localDevAuth';

/** Meta app id — same as Firebase Facebook provider. */
const FB_APP_ID = '1718617005774108';
const FB_MOBILE_LOGIN_KEY = 'dineb_fb_mobile_login';

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
            }, true);
        } catch {
            resolve(null);
        }
    });
}

/** @deprecated Use peekFacebookMobileLoginPending */
export function peekFacebookIosLoginPending() {
    return peekFacebookMobileLoginPending();
}

export function peekFacebookMobileLoginPending() {
    if (!shouldUseFacebookMobileSdk()) return false;
    try {
        return sessionStorage.getItem(FB_MOBILE_LOGIN_KEY) === '1';
    } catch {
        return false;
    }
}

export function markFacebookMobileLoginPending() {
    try {
        sessionStorage.setItem(FB_MOBILE_LOGIN_KEY, '1');
    } catch {
        /* ignore */
    }
}

/** @deprecated Use clearFacebookMobileLoginPending */
export function clearFacebookIosLoginPending() {
    clearFacebookMobileLoginPending();
}

export function clearFacebookMobileLoginPending() {
    try {
        sessionStorage.removeItem(FB_MOBILE_LOGIN_KEY);
        // Legacy key from iOS-only path
        sessionStorage.removeItem('dineb_fb_ios_login');
    } catch {
        /* ignore */
    }
}

/**
 * Phone browsers: Meta JS SDK + Firebase credential.
 * Avoids Firebase /__/auth on firebaseapp.com ("missing initial state" on Android).
 */
export function shouldUseFacebookMobileSdk() {
    return isIosTouchDevice() || isAndroidTouchDevice();
}

/** @deprecated Use shouldUseFacebookMobileSdk */
export function shouldUseFacebookIosSdk() {
    return shouldUseFacebookMobileSdk();
}

/**
 * After Meta returns to /login, read access token.
 * @returns {Promise<string | null>}
 */
export async function completeFacebookMobileRedirectReturn() {
    if (!shouldUseFacebookMobileSdk() || !peekFacebookMobileLoginPending()) {
        return null;
    }
    clearOAuthRedirectPending();
    try {
        const FB = await loadFacebookSDK();
        const token = await readFacebookAccessToken(FB);
        clearFacebookMobileLoginPending();
        dismissFacebookSdkOverlay();
        return token;
    } catch {
        clearFacebookMobileLoginPending();
        dismissFacebookSdkOverlay();
        return null;
    }
}

/** @deprecated Use completeFacebookMobileRedirectReturn */
export async function completeFacebookIosRedirectReturn() {
    return completeFacebookMobileRedirectReturn();
}

/**
 * Start Facebook login on phone browsers via Meta SDK (not Firebase redirect/popup).
 */
export async function startFacebookMobileLogin() {
    if (!shouldUseFacebookMobileSdk()) {
        const err = new Error('Facebook mobile SDK login called on non-mobile device');
        err.code = 'auth/operation-not-allowed';
        throw err;
    }
    clearOAuthRedirectPending();
    dismissFacebookSdkOverlay();
    markFacebookMobileLoginPending();

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
            clearFacebookMobileLoginPending();
            finish(
                reject,
                Object.assign(new Error('Facebook login timed out.'), {
                    code: 'auth/popup-closed-by-user',
                })
            );
        }, 120000);

        FB.login(
            (response) => {
                if (response?.status === 'connected' && response.authResponse?.accessToken) {
                    clearFacebookMobileLoginPending();
                    finish(resolve, response.authResponse.accessToken);
                    return;
                }
                if (response?.status === 'unknown' || !response.authResponse) {
                    clearFacebookMobileLoginPending();
                    finish(
                        reject,
                        Object.assign(new Error('Facebook login was cancelled.'), {
                            code: 'auth/popup-closed-by-user',
                        })
                    );
                    return;
                }
                clearFacebookMobileLoginPending();
                finish(reject, new Error(`Facebook login failed: ${response.status}`));
            },
            { scope: 'email,public_profile', return_scopes: true }
        );
    });
}

/** @deprecated Use startFacebookMobileLogin */
export async function startFacebookIosRedirectLogin() {
    return startFacebookMobileLogin();
}
