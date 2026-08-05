/**
 * Compatibility re-exports — Facebook phone login lives in facebookMobileSignIn.js.
 * Meta SDK is Android-only; iOS uses Firebase Facebook redirect (user-gesture safe).
 */
export {
    peekFacebookIosLoginPending,
    peekFacebookMobileLoginPending,
    clearFacebookIosLoginPending,
    clearFacebookMobileLoginPending,
    shouldUseFacebookIosSdk,
    shouldUseFacebookMobileSdk,
    completeFacebookIosRedirectReturn,
    completeFacebookMobileRedirectReturn,
    startFacebookIosRedirectLogin,
    startFacebookMobileLogin,
    preloadFacebookMobileSdk,
} from './facebookMobileSignIn';
