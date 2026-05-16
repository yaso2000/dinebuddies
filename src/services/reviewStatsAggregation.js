/**
 * Shared Firestore reads for average rating + review count per business id.
 * Used by InvitationContext (directory snapshot) and rankingDataLoader to avoid duplicated query logic.
 */
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const DEFAULT_BATCH = 10;
const DEFAULT_PER_QUERY = 100;

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string[]} ids Business / partner document ids (same as public_profiles doc ids)
 * @param {{ batchSize?: number, perQueryLimit?: number }} [opts]
 * @returns {Promise<Record<string, { averageRating: number, reviewCount: number }>>}
 */
export async function aggregateReviewStatsByBusinessIds(db, ids, opts = {}) {
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (list.length === 0) return {};

    const batchSize = opts.batchSize ?? DEFAULT_BATCH;
    const perQueryLimit = opts.perQueryLimit ?? DEFAULT_PER_QUERY;

    const reviewsRef = collection(db, 'reviews');
    const byDocId = new Map();

    for (let i = 0; i < list.length; i += batchSize) {
        const chunk = list.slice(i, i + batchSize);
        const [sp, sf, sr] = await Promise.all([
            getDocs(query(reviewsRef, where('partnerId', 'in', chunk), limit(perQueryLimit))),
            getDocs(query(reviewsRef, where('profileId', 'in', chunk), limit(perQueryLimit))),
            getDocs(query(reviewsRef, where('restaurantId', 'in', chunk), limit(perQueryLimit))),
        ]);
        [sp.docs, sf.docs, sr.docs].flat().forEach((d) => byDocId.set(d.id, d.data()));
    }

    const byBusinessId = {};
    list.forEach((id) => {
        const reviews = [...byDocId.values()].filter(
            (r) => r.partnerId === id || r.profileId === id || r.restaurantId === id
        );
        const count = reviews.length;
        const total = reviews.reduce((s, r) => s + (r.rating || 0), 0);
        byBusinessId[id] = { averageRating: count > 0 ? total / count : 0, reviewCount: count };
    });
    return byBusinessId;
}
