import {
    hasFirebaseAuthReturnInUrl,
    peekOAuthRedirectPending,
    peekOAuthRedirectProvider,
} from './localDevAuth';

/** Active OAuth redirect return in the URL — not stale localStorage flags. */
export function isOAuthRedirectInFlight() {
    return hasFirebaseAuthReturnInUrl();
}

/** True when we must run getRedirectResult (any device — not iOS-only). */
export function shouldRunOAuthRedirectBootstrap() {
    if (hasFirebaseAuthReturnInUrl()) return true;
    if (peekOAuthRedirectPending()) return true;
    if (peekOAuthRedirectProvider()) return true;
    return false;
}

/** OAuth redirect profile creation may still be in flight — do not mark bootstrap done without a profile. */
export function needsOAuthRedirectProfileFinish() {
    // Stale pending flags were blocking profileServerSynced forever on /login after redirect.
    return hasFirebaseAuthReturnInUrl();
}
