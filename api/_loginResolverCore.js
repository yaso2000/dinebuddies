import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { formatToE164, isValidE164 } from './_phoneUtils.js';
import { isClaimedBusinessProfile, isUnclaimedBusinessProfile } from './_businessPhoneRegistry.js';

export const UNIFIED_AUTH_ERROR_AR =
    'البريد الإلكتروني، رقم الجوال، أو كلمة المرور غير صحيحة.';

export const AI_UNCLAIMED_ERROR_AR =
    'هذا الحساب منشأ تلقائياً بالذكاء الاصطناعي. يرجى الضغط على "استعادة الحساب وتوثيقه عبر SMS" أولاً لتتمكن من تعيين كلمة مرور والدخول.';

export const AI_UNCLAIMED_CODE = 'unclaimed-ai-profile';

/** استعادة كلمة المرور — نفس الرد عند عدم وجود حساب (منع صيد الأرقام) */
export const RESET_GENERIC_SUCCESS_AR =
    'إذا كان الحساب موجوداً، فقد أرسلنا رابط الاستعادة.';

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function identifierToE164(identifier, defaultCountryCode = '+20') {
    const s = String(identifier || '').trim();
    if (!s || looksLikeEmail(s)) return '';
    if (s.startsWith('+')) {
        const digits = s.replace(/\D/g, '');
        return digits.length >= 8 ? `+${digits}` : '';
    }
    return formatToE164(defaultCountryCode, s);
}

function isBusinessDoc(data) {
    if (!data || typeof data !== 'object') return false;
    const role = String(data.role || '').toLowerCase();
    const at = String(data.accountType || '').toLowerCase();
    return role === 'business' || role === 'partner' || at === 'business';
}

/**
 * البريد المرتبط بـ Firebase Auth (authInfo.email أولاً ثم الحقول القديمة).
 * @param {Record<string, unknown>} data
 */
export function pickAuthEmailFromUserDoc(data) {
    const authInfo =
        data.authInfo && typeof data.authInfo === 'object' ? data.authInfo : null;
    const fromAuthInfo = authInfo?.email;
    const em = String(
        fromAuthInfo || data.email || data.authEmail || ''
    )
        .trim()
        .toLowerCase();
    return em.includes('@') ? em : null;
}

function phoneDocClaimState(data) {
    const bi =
        data.businessInfo && typeof data.businessInfo === 'object'
            ? data.businessInfo
            : {};
    if (bi.isClaimed === false) return 'unclaimed';
    if (bi.isClaimed === true) return 'claimed';
    if (isUnclaimedBusinessProfile(data) && !isClaimedBusinessProfile(data)) {
        return 'unclaimed';
    }
    if (isClaimedBusinessProfile(data)) return 'claimed';
    return 'unknown';
}

/**
 * @param {string} identifier
 * @param {string} [defaultCountryCode]
 * @returns {Promise<
 *   | { status: 'ok', loginEmail: string, businessId?: string }
 *   | { status: 'error', code: string, message: string }
 * >}
 */
export async function resolveBusinessLoginIdentifier(identifier, defaultCountryCode = '+20') {
    const raw = String(identifier || '').trim();
    if (!raw) {
        return {
            status: 'error',
            code: 'invalid-input',
            message: UNIFIED_AUTH_ERROR_AR,
        };
    }

    if (looksLikeEmail(raw)) {
        return { status: 'ok', loginEmail: raw.toLowerCase() };
    }

    const e164 = identifierToE164(raw, defaultCountryCode);
    if (!isValidE164(e164)) {
        return {
            status: 'error',
            code: 'invalid-phone',
            message: UNIFIED_AUTH_ERROR_AR,
        };
    }

    ensureFirebaseAdmin();
    const db = getFirestore();
    const snap = await db
        .collection('users')
        .where('businessInfo.standardized_phone', '==', e164)
        .limit(5)
        .get();

    if (snap.empty) {
        return {
            status: 'error',
            code: 'not-found',
            message: UNIFIED_AUTH_ERROR_AR,
        };
    }

    for (const doc of snap.docs) {
        const data = doc.data();
        if (!isBusinessDoc(data)) continue;

        const bi =
            data.businessInfo && typeof data.businessInfo === 'object'
                ? data.businessInfo
                : {};

        if (bi.isClaimed === false || phoneDocClaimState(data) === 'unclaimed') {
            return {
                status: 'error',
                code: AI_UNCLAIMED_CODE,
                message: AI_UNCLAIMED_ERROR_AR,
                businessId: doc.id,
            };
        }

        const authInfo =
            data.authInfo && typeof data.authInfo === 'object' ? data.authInfo : null;
        const fromAuthInfo = String(authInfo?.email || '').trim().toLowerCase();
        const loginEmail =
            fromAuthInfo.includes('@') ? fromAuthInfo : pickAuthEmailFromUserDoc(data);

        if (loginEmail && (bi.isClaimed === true || phoneDocClaimState(data) === 'claimed')) {
            return {
                status: 'ok',
                loginEmail,
                businessId: doc.id,
                standardizedPhone: e164,
            };
        }
    }

    return {
        status: 'error',
        code: 'not-found',
        message: UNIFIED_AUTH_ERROR_AR,
    };
}

/**
 * حل معرّف استعادة كلمة المرور — لا يكشف وجود/عدم وجود رقم الجوال.
 * @returns {Promise<{ status: 'ok', loginEmail: string | null, genericOnly: boolean, message: string }>}
 */
export async function resolveBusinessPasswordReset(identifier, defaultCountryCode = '+20') {
    const raw = String(identifier || '').trim();
    const generic = {
        status: 'ok',
        loginEmail: null,
        genericOnly: true,
        message: RESET_GENERIC_SUCCESS_AR,
    };

    if (!raw) {
        return generic;
    }

    if (looksLikeEmail(raw)) {
        return {
            status: 'ok',
            loginEmail: raw.toLowerCase(),
            genericOnly: false,
            message: RESET_GENERIC_SUCCESS_AR,
        };
    }

    const e164 = identifierToE164(raw, defaultCountryCode);
    if (!isValidE164(e164)) {
        return generic;
    }

    ensureFirebaseAdmin();
    const db = getFirestore();
    const snap = await db
        .collection('users')
        .where('businessInfo.standardized_phone', '==', e164)
        .limit(1)
        .get();

    if (snap.empty) {
        return generic;
    }

    const data = snap.docs[0].data();
    if (!isBusinessDoc(data)) {
        return generic;
    }

    const loginEmail = pickAuthEmailFromUserDoc(data);
    if (!loginEmail) {
        return generic;
    }

    return {
        status: 'ok',
        loginEmail,
        genericOnly: false,
        message: RESET_GENERIC_SUCCESS_AR,
    };
}
