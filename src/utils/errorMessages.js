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
        return tAuth('auth_oauth_setup_hint', 'OAuth setup error. Check Google Cloud and Firebase Auth domains.');
    }
    if (/apple\.com|Sign in with Apple|invalid.*apple/i.test(combined) && error?.code === 'auth/operation-not-allowed') {
        return tAuth(
            'auth_apple_not_enabled',
            'Apple sign-in is not enabled yet. Enable it in Firebase Console → Authentication.'
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
        return i18n.t(i18nKey, { defaultValue: error.message || '' });
    }
    return tAuth('auth_error_fallback', 'Something went wrong. Please try again.');
}
