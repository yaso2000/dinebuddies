import { hasFirebaseAuthReturnInUrl, isIosTouchDevice, peekOAuthRedirectPending } from './localDevAuth';

/** Active OAuth redirect return in the URL — not stale localStorage flags. */
export function isOAuthRedirectInFlight() {
    return hasFirebaseAuthReturnInUrl();
}

/** Run getRedirectResult when OAuth returned in URL, or iOS redirect was started (hash may arrive late). */
export function shouldRunOAuthRedirectBootstrap() {
    if (hasFirebaseAuthReturnInUrl()) return true;
    if (isIosTouchDevice() && peekOAuthRedirectPending()) return true;
    return false;
}

/** OAuth redirect profile creation may still be in flight — do not mark bootstrap done without a profile. */
export function needsOAuthRedirectProfileFinish() {
    return shouldRunOAuthRedirectBootstrap();
}
