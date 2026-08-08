/**
 * Detects whether an email is already tied to a business or affiliate account in Firestore.
 * Used before personal OAuth / consumer email flows so portals stay separated.
 */
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAffiliateAgentProfileData, profileDocumentIsBusiness } from './accountRole';

function normalizeEmail(e) {
    return String(e || '').trim().toLowerCase();
}

function docLooksLikeBusiness(data) {
    return profileDocumentIsBusiness(data);
}

/**
 * @param {string} emailRaw
 * @returns {Promise<boolean>}
 */
function docLooksLikeAffiliate(data) {
    return isAffiliateAgentProfileData(data);
}

async function emailMatchesRole(emailRaw, matcher) {
    const email = normalizeEmail(emailRaw);
    if (!email) return false;
    const run = async (field) => {
        const q = query(collection(db, 'users'), where(field, '==', email), limit(10));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            if (matcher(d.data())) return true;
        }
        return false;
    };
    try {
        if (await run('email')) return true;
        if (await run('authEmail')) return true;
        return false;
    } catch (e) {
        console.warn('[authEmailConflict] query not allowed pre-auth, skipping:', e?.code || e?.message);
        return false;
    }
}

export async function isEmailRegisteredAsBusiness(emailRaw) {
    return emailMatchesRole(emailRaw, docLooksLikeBusiness);
}

/** @param {string} emailRaw */
export async function isEmailRegisteredAsAffiliate(emailRaw) {
    return emailMatchesRole(emailRaw, docLooksLikeAffiliate);
}
