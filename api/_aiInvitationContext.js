import { isBusinessUserDoc } from './_dineCredits.js';

const MAX_TAGLINE_CHARS = 120;
const MAX_DESCRIPTION_CHARS = 300;
const MAX_OFFER_TITLE_CHARS = 80;
const MAX_OFFER_DESC_CHARS = 150;
const MAX_OFFERS = 2;

function clip(value, maxLen) {
    const s = String(value || '').trim();
    if (!s) return '';
    return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
}

function pickString(...values) {
    for (const value of values) {
        const s = String(value || '').trim();
        if (s) return s;
    }
    return '';
}

/**
 * @param {Record<string, unknown>} userData
 * @returns {'user' | 'business'}
 */
export function resolveAccountType(userData) {
    return isBusinessUserDoc(userData) ? 'business' : 'user';
}

/**
 * @param {Record<string, unknown>} userData
 * @returns {import('../src/services/GeminiService.js').BusinessInvitationContext | undefined}
 */
export function extractBusinessInvitationContext(userData) {
    const bi =
        userData?.businessInfo && typeof userData.businessInfo === 'object' && !Array.isArray(userData.businessInfo)
            ? /** @type {Record<string, unknown>} */ (userData.businessInfo)
            : {};

    const businessName = pickString(userData.display_name, bi.businessName, userData.name);
    const businessType = pickString(bi.businessType);
    const tagline = clip(bi.tagline, MAX_TAGLINE_CHARS);
    const description = clip(bi.description, MAX_DESCRIPTION_CHARS);
    const city = pickString(bi.city, userData.location?.city);
    const country = pickString(bi.country, userData.location?.country);
    const address = pickString(bi.address, bi.location);

    const context = {
        ...(businessName ? { businessName } : {}),
        ...(businessType ? { businessType } : {}),
        ...(tagline ? { tagline } : {}),
        ...(description ? { description } : {}),
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
        ...(address ? { address } : {}),
    };

    return Object.keys(context).length > 0 ? context : undefined;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @returns {Promise<{ title: string, description?: string }[]>}
 */
export async function fetchActiveBusinessOffers(db, uid) {
    /** @type {{ title: string, description?: string }[]} */
    const offers = [];

    const pushOffer = (raw) => {
        const title = clip(raw?.title || raw?.content?.title, MAX_OFFER_TITLE_CHARS);
        const description = clip(raw?.description || raw?.content?.description, MAX_OFFER_DESC_CHARS);
        if (!title && !description) return;
        offers.push({
            title: title || description,
            ...(description && title !== description ? { description } : {}),
        });
    };

    try {
        const activeSnap = await db
            .collection('active_offers')
            .where('partnerId', '==', uid)
            .limit(MAX_OFFERS)
            .get();

        for (const doc of activeSnap.docs) {
            pushOffer(doc.data());
            if (offers.length >= MAX_OFFERS) break;
        }
    } catch (e) {
        console.warn('[aiInvitationContext] active_offers fetch failed', e);
    }

    if (offers.length >= MAX_OFFERS) {
        return offers.slice(0, MAX_OFFERS);
    }

    try {
        const legacySnap = await db
            .collection('special_offers')
            .where('restaurantId', '==', uid)
            .where('status', 'in', ['active', 'published'])
            .limit(MAX_OFFERS)
            .get();

        for (const doc of legacySnap.docs) {
            pushOffer(doc.data());
            if (offers.length >= MAX_OFFERS) break;
        }
    } catch (e) {
        console.warn('[aiInvitationContext] special_offers fetch failed', e);
    }

    return offers.slice(0, MAX_OFFERS);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {Record<string, unknown>} userData
 * @param {string} postType
 */
const BUSINESS_CONTEXT_POST_TYPES = new Set(['invitation', 'featured_post', 'animated_post']);

export async function resolveInvitationCallerContext(db, uid, userData, postType) {
    const accountType = resolveAccountType(userData);

    if (accountType !== 'business' || !BUSINESS_CONTEXT_POST_TYPES.has(postType)) {
        return { accountType: /** @type {'user' | 'business'} */ (accountType) };
    }

    const baseContext = extractBusinessInvitationContext(userData) || {};
    const offers = await fetchActiveBusinessOffers(db, uid);

    /** @type {import('../src/services/GeminiService.js').BusinessInvitationContext} */
    const businessContext = {
        ...baseContext,
        ...(offers.length > 0 ? { offers } : {}),
    };

    return {
        accountType: 'business',
        businessContext: Object.keys(businessContext).length > 0 ? businessContext : undefined,
    };
}
