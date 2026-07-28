/**
 * Compatibility re-exports — Facebook phone login lives in facebookMobileSignIn.js
 * (Android + iOS Meta SDK path; avoids firebaseapp.com missing-initial-state).
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
} from './facebookMobileSignIn';
