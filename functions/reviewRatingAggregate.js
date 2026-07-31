/**
 * Aggregate business star ratings from review documents.
 * Only ratings in [1, 5] count — unbounded values must not poison
 * public_profiles.averageRating or ranking scores.
 */

const MIN_STAR_RATING = 1;
const MAX_STAR_RATING = 5;

/**
 * @param {unknown} value
 * @returns {number|null} finite rating in [1, 5], else null
 */
function normalizeStarRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < MIN_STAR_RATING || n > MAX_STAR_RATING) return null;
    return n;
}

/**
 * @param {Iterable<{ id: string, rating?: unknown }>} reviews
 * @returns {{ averageRating: number, reviewCount: number, total: number }}
 */
function aggregateReviewRatings(reviews) {
    const seen = new Set();
    let total = 0;
    let count = 0;

    for (const review of reviews || []) {
        const id = review && review.id != null ? String(review.id) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const rating = normalizeStarRating(review.rating);
        if (rating == null) continue;

        total += rating;
        count += 1;
    }

    const averageRating = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    return { averageRating, reviewCount: count, total };
}

module.exports = {
    MIN_STAR_RATING,
    MAX_STAR_RATING,
    normalizeStarRating,
    aggregateReviewRatings,
};
