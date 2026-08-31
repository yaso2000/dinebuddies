/**
 * Marks that an in-flight Google sign-in was started from the BUSINESS signup
 * button (not consumer login). The flag lives in sessionStorage so it survives an
 * OAuth redirect round-trip within the same tab. When set, a brand-new Google
 * user is provisioned as a business shell (registrationIntent:'business') instead
 * of a consumer profile — so the two account kinds never get mixed.
 */
const KEY = 'db_business_google_signup';

export function stashBusinessGoogleSignupIntent() {
    try {
        sessionStorage.setItem(KEY, '1');
    } catch {
        /* storage unavailable — best effort */
    }
}

export function peekBusinessGoogleSignupIntent() {
    try {
        return sessionStorage.getItem(KEY) === '1';
    } catch {
        return false;
    }
}

export function clearBusinessGoogleSignupIntent() {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        /* ignore */
    }
}
