/**
 * Detects whether an email is already tied to a business account in Firestore.
 * Used when a user tries personal OAuth (Google/Facebook) with the same email as a business (password) account.
 */
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

function normalizeEmail(e) {
    return String(e || '').trim().toLowerCase();
}

function docLooksLikeBusiness(data) {
    if (!data || typeof data !== 'object') return false;
    const r = String(data.role || '').toLowerCase();
    if (r === 'business' || r === 'partner') return true;
    if (String(data.registrationIntent || '').toLowerCase() === 'business') return true;
    const bi = data.businessInfo;
    return !!(bi && typeof bi === 'object' && Object.keys(bi).length > 0);
}

/**
 * @param {string} emailRaw
 * @returns {Promise<boolean>}
 */
export async function isEmailRegisteredAsBusiness(emailRaw) {
    const email = normalizeEmail(emailRaw);
    if (!email) return false;
    const run = async (field) => {
        const q = query(collection(db, 'users'), where(field, '==', email), limit(10));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            if (docLooksLikeBusiness(d.data())) return true;
        }
        return false;
    };
    if (await run('email')) return true;
    if (await run('authEmail')) return true;
    return false;
}
