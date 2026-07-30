/**
 * Whether Auth sign-in should run createUserProfile for this Firestore users/{uid} doc.
 *
 * Auth email-flag sync used to setDoc-merge `{ emailVerified, authEmail }` on login. That can
 * create an incomplete stub before Google/Facebook finish their exists()-check, so sign-in
 * skips profile bootstrap and the account never gets role / welcome credits / display fields.
 *
 * Mid-flow business signup stubs (registrationIntent:business) must not be bootstrapped as
 * consumers — createUserProfile would race the business setDoc.
 *
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {boolean}
 */
export function needsUserProfileBootstrap(data) {
    if (!data || typeof data !== 'object') return true;
    if (String(data.registrationIntent || '').toLowerCase() === 'business') return false;
    if (!Object.prototype.hasOwnProperty.call(data, 'role')) return true;
    const role = data.role;
    return role == null || role === '';
}
