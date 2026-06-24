/**
 * Maps Firebase Auth and other error codes to user-friendly messages.
 * Used by ToastContext and AuthContext — resolves via i18n when a locale key exists.
 */
import i18n from '../i18n';

/** @type {Record<string, string>} Firebase / Firestore code → i18n key */
const CODE_TO_I18N_KEY = {
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
    'auth/network-request-failed': 'auth_network_request_failed',
    'auth/too-many-requests': 'auth_too_many_requests',
    'auth/invalid-credential': 'auth_invalid_credential',
    'auth/user-not-found': 'auth_user_not_found',
    'auth/wrong-password': 'auth_wrong_password',
    'auth/email-already-in-use': 'auth_email_already_in_use',
    'auth/weak-password': 'auth_weak_password',
    'auth/invalid-verification-code': 'auth_invalid_verification_code',
    'auth/invalid-phone-number': 'auth_invalid_phone_number',
    'auth/captcha-check-failed': 'auth_captcha_check_failed',
    'auth/requires-recent-login': 'auth_requires_recent_login',
    'auth/account-exists-with-different-credential': 'auth_account_exists_with_different_credential',
    'auth/business-email-in-use': 'auth_business_email_conflict',
    'auth/affiliate-email-in-use': 'auth_affiliate_email_in_use',
    'auth/business-portal-only': 'auth_business_portal_only',
    'auth/consumer-portal-only': 'auth_consumer_portal_only',
    'auth/affiliate-portal-only': 'auth_affiliate_portal_only',
    'auth/personal-portal-only': 'auth_personal_portal_only',
    'auth/operation-not-allowed': 'auth_operation_not_allowed',
    'auth/configuration-not-found': 'auth_configuration_not_found',
    'auth/embedded-oauth-redirect-lost': 'auth_embedded_oauth_redirect_lost',
    'auth/missing-email': 'auth_missing_email',
    'auth/invalid-email': 'auth_invalid_email',
    'permission-denied': 'auth_permission_denied',
    unavailable: 'auth_unavailable',
    'failed-precondition': 'auth_failed_precondition',
};

function tAuth(key, defaultValue) {
    if (!key) return '';
    return i18n.t(key, { defaultValue: defaultValue || '' });
}

/**
 * @param {Error & { code?: string }} error - Firebase Auth or similar error
 * @returns {string} User-friendly message, or empty string for silent errors (e.g. popup closed)
 */
export function getAuthErrorMessage(error) {
    const combined = `${error?.code || ''} ${error?.message || ''}`;
    if (/redirect_uri_mismatch|invalid_client|OAuth 2 parameters/i.test(combined)) {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            const origin = window.location.origin;
            return tAuth(
                'auth_oauth_localhost_setup',
                `Google OAuth is not configured for ${origin}. Run "npm run oauth:local-setup" and add that origin in Google Cloud → Credentials → Web client → Authorized JavaScript origins.`
            );
        }
        return tAuth('auth_oauth_setup_hint', 'OAuth setup error. Check Google Cloud and Firebase Auth domains.');
    }
    if (/disallowed_useragent|doesn't comply with Google's OAuth 2.0 policy/i.test(combined)) {
        return tAuth(
            'auth_webview_blocked',
            'Google blocks sign-in inside embedded browsers. Open this page in Chrome instead.'
        );
    }
    if (/apple\.com|Sign in with Apple|invalid.*apple/i.test(combined)) {
        if (error?.code === 'auth/operation-not-allowed') {
            return tAuth(
                'auth_apple_not_enabled',
                'Apple sign-in is not enabled yet. Enable it in Firebase Console → Authentication.'
            );
        }
        if (error?.code === 'auth/internal-error' || error?.code === 'auth/invalid-credential') {
            return tAuth(
                'auth_apple_config_mismatch',
                'Apple Sign-In failed. In Apple Developer, set Return URL to your Firebase handler (run npm run oauth:apple-setup for the exact URL). Also verify Services ID and key in Firebase → Apple provider.'
            );
        }
        if (error?.code === 'auth/unauthorized-domain') {
            return tAuth(
                'auth_apple_unauthorized_domain',
                'This website domain is not authorized. Add www.dinebuddies.com and dinebuddies.com in Firebase → Authentication → Authorized domains, and in Apple Developer → Services ID → Domains.'
            );
        }
    }
    if (error?.code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const port = typeof window !== 'undefined' ? window.location.port || '5176' : '5176';
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
            return tAuth(
                'auth_unauthorized_domain_lan',
                `This address (${host}) is not allowed for sign-in. Open http://localhost:${port}/login instead of the network IP.`
            );
        }
        return tAuth(
            'auth_unauthorized_domain',
            `Add "${host || 'localhost'}" in Firebase Console → Authentication → Settings → Authorized domains.`
        );
    }
    if (!error?.code) {
        return tAuth('auth_error_fallback', 'Something went wrong. Please try again.');
    }
    const i18nKey = CODE_TO_I18N_KEY[error.code];
    if (i18nKey === '') return '';
    if (i18nKey && i18n.exists(i18nKey)) {
        return i18n.t(i18nKey);
    }
    if (i18nKey) {
        const defaults = {
            auth_embedded_oauth_redirect_lost:
                'Sign-in could not finish after redirect. On iPhone, use Safari at www.dinebuddies.com/login (not an in-app browser).',
        };
        return i18n.t(i18nKey, { defaultValue: defaults[i18nKey] || error.message || '' });
    }
    const codeSuffix = error?.code ? ` (${error.code})` : '';
    return tAuth('auth_error_fallback', `Something went wrong. Please try again.${codeSuffix}`);
}
