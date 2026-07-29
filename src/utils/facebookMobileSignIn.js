import { dismissFacebookSdkOverlay } from './facebookSdkCleanup';
import {
    clearOAuthRedirectPending,
    isAndroidTouchDevice,
} from './localDevAuth';

/** Meta app id — same as Firebase Facebook provider. */
const FB_APP_ID = '1718617005774108';
const FB_MOBILE_LOGIN_KEY = 'dineb_fb_mobile_login';

let sdkLoadPromise = null;

function loadFacebookSDK() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Facebook login requires a browser'));
    }
    if (window.FB) return Promise.resolve(window.FB);
    if (sdkLoadPromise) return sdkLoadPromise;

    sdkLoadPromise = new Promise((resolve, reject) => {
        const finish = (FB) => {
            resolve(FB);
        };
        const fail = (err) => {
            sdkLoadPromise = null;
            reject(err);
        };

        window.fbAsyncInit = () => {
            try {
                window.FB.init({
                    appId: FB_APP_ID,
                    version: 'v19.0',
                    cookie: true,
                    xfbml: false,
                });
                finish(window.FB);
            } catch (err) {
                fail(err);
            }
        };

        const existing = document.getElementById('facebook-jssdk');
        if (existing) {
            if (window.FB) finish(window.FB);
            return;
        }

        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.onerror = () => fail(new Error('Failed to load Facebook SDK'));
        document.head.appendChild(script);
    });

    return sdkLoadPromise;
}

/** Warm the Meta SDK on Android login so the tap→FB.login gap stays short. */
export function preloadFacebookMobileSdk() {
    if (!shouldUseFacebookMobileSdk()) return;
    void loadFacebookSDK().catch(() => {});
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
        sessionStorage.removeItem('dineb_fb_ios_login');
    } catch {
        /* ignore */
    }
}

/**
 * Meta JS SDK path — Android only.
 * iPhone Safari blocks FB.login after any await (lost user gesture), so iOS uses
 * Firebase Facebook redirect instead (same-origin www authDomain).
 */
export function shouldUseFacebookMobileSdk() {
    return isAndroidTouchDevice();
}

/** @deprecated Name kept for callers; now means “use Meta mobile SDK” (Android). */
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
 * Start Facebook login on Android via Meta SDK (not Firebase redirect/popup).
 */
export async function startFacebookMobileLogin() {
    if (!shouldUseFacebookMobileSdk()) {
        const err = new Error('Facebook mobile SDK login called on non-Android device');
        err.code = 'auth/operation-not-allowed';
        throw err;
    }
    clearOAuthRedirectPending();
    dismissFacebookSdkOverlay();
    markFacebookMobileLoginPending();

    const FB = await loadFacebookSDK();
    const redirectUri =
        typeof window !== 'undefined'
            ? `${window.location.origin}/login`
            : 'https://www.dinebuddies.com/login';

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
            {
                scope: 'email,public_profile',
                return_scopes: true,
                // Helps Meta fall back to redirect when the dialog cannot open.
                fallback_redirect_uri: redirectUri,
            }
        );
    });
}

/** @deprecated Use startFacebookMobileLogin */
export async function startFacebookIosRedirectLogin() {
    return startFacebookMobileLogin();
}
