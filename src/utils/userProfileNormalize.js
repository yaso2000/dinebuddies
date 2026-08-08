import { DEFAULT_ACCESS_PLATFORM } from '../constants/userProfileSchema';
import { isAffiliateAgentProfileData } from './accountRole';

/**
 * Same rules as AuthContext profile listener — single source for “is this a business account?”
 * Use when reading users/{uid} outside AuthContext (e.g. BusinessProfile onSnapshot on raw doc data).
 */
export function normalizeUserProfile(data) {
    if (!data) return null;
    const roleLc = String(data.role || '').toLowerCase();
    const accountTypeLc = String(data.accountType || '').toLowerCase();
    const hasBusinessInfoDoc =
        data.businessInfo &&
        typeof data.businessInfo === 'object' &&
        Object.keys(data.businessInfo).length > 0;
    const isAffiliateAgentDoc = isAffiliateAgentProfileData(data);
    const isBusinessDoc =
        !isAffiliateAgentDoc &&
        (roleLc === 'business' ||
            roleLc === 'partner' ||
            accountTypeLc === 'business' ||
            hasBusinessInfoDoc);
    const isGuestProfile = roleLc === 'guest' || data.isGuest === true;
    const regIntentLc = String(data.registrationIntent || '').toLowerCase();
    /** Firestore flag from email business signup (main.jsx) — must not be lost when role is already `business`. */
    const pendingFromFirestore = data.pendingBusinessRegistration === true;
    const pendingFromIntent =
        regIntentLc === 'business' &&
        !hasBusinessInfoDoc &&
        roleLc !== 'business' &&
        roleLc !== 'partner';
    const pendingBusinessRegistration =
        isAffiliateAgentDoc ? false : pendingFromFirestore || pendingFromIntent;
    const isBusiness = isAffiliateAgentDoc ? false : isBusinessDoc || pendingBusinessRegistration;
    const accessPlatform =
        typeof data.access_platform === 'string' && data.access_platform.trim()
            ? String(data.access_platform).trim().toLowerCase()
            : DEFAULT_ACCESS_PLATFORM;

    const referralCode =
        typeof data.referral_code === 'string' && data.referral_code.trim()
            ? String(data.referral_code).trim().toUpperCase()
            : '';
    const referralLink = typeof data.referral_link === 'string' ? data.referral_link.trim() : '';
    const totalClicks =
        typeof data.total_clicks === 'number' && Number.isFinite(data.total_clicks) ? data.total_clicks : 0;
    const currentBalanceCents =
        typeof data.current_balance === 'number' && Number.isFinite(data.current_balance)
            ? Math.max(0, Math.floor(data.current_balance))
            : 0;
    const totalEarnedCents =
        typeof data.total_earned === 'number' && Number.isFinite(data.total_earned)
            ? Math.max(0, Math.floor(data.total_earned))
            : 0;
    const pendingReferralsCount =
        typeof data.pending_referrals_count === 'number' && Number.isFinite(data.pending_referrals_count)
            ? Math.max(0, Math.floor(data.pending_referrals_count))
            : 0;
    const successfulReferralsCount =
        typeof data.successful_referrals_count === 'number' && Number.isFinite(data.successful_referrals_count)
            ? Math.max(0, Math.floor(data.successful_referrals_count))
            : 0;
    const pendingPayoutsCents =
        typeof data.pending_payouts === 'number' && Number.isFinite(data.pending_payouts)
            ? Math.max(0, Math.floor(data.pending_payouts))
            : 0;

    const ageCategory =
        data.ageCategory || data.age_category || (typeof data.age === 'string' ? data.age : '') || '';

    return {
        ...data,
        ageCategory,
        age_category: data.age_category || data.ageCategory || ageCategory,
        access_platform: accessPlatform,
        referral_code: referralCode,
        referral_link: referralLink,
        total_clicks: totalClicks,
        current_balance: currentBalanceCents,
        total_earned: totalEarnedCents,
        pending_referrals_count: pendingReferralsCount,
        successful_referrals_count: successfulReferralsCount,
        pending_payouts: pendingPayoutsCents,
        id: data.id || data.uid || '',
        uid: data.uid || data.id || '',
        displayName: data.displayName || data.display_name || data.nickname || '',
        display_name: data.display_name || data.displayName || data.nickname || '',
        photoURL: data.photoURL || data.photo_url || data.avatar || '',
        photo_url: data.photo_url || data.photoURL || data.avatar || '',
        isBusiness,
        isGuest: isGuestProfile,
        pendingBusinessRegistration,
        role: isGuestProfile
            ? 'guest'
            : isAffiliateAgentDoc
                ? 'affiliate_agent'
                : (isBusinessDoc || pendingBusinessRegistration)
                    ? 'business'
                    : (data.role || 'user'),
        isProfileComplete: isGuestProfile
            ? true
            : isAffiliateAgentDoc
                ? true
                : pendingBusinessRegistration
                    ? false
                    : isBusiness
                        ? true
                        : data.isProfileComplete === true || (
                            (data.displayName || data.display_name || data.nickname) &&
                            data.gender &&
                            (ageCategory || (typeof data.age === 'number' && data.age > 0))
                        )
    };
}
