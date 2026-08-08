/**
 * Business ranking points:
 * - 5 pts when a hosted invitation is completed at the venue (restaurantId)
 * - 1 pt per profile like
 * - 1 pt per post like
 * - 1 pt per star in each review (5-star review = 5 pts)
 */

export const BUSINESS_POINT_VALUES = {
    hosting: 5,
    profileLike: 1,
    postLike: 1,
    ratingStar: 1,
};

/**
 * @param {{
 *   hostedInvitations?: number,
 *   totalInvitations?: number,
 *   profileLikes?: number,
 *   postLikes?: number,
 *   ratingStarsTotal?: number,
 *   rating?: number,
 *   reviewCount?: number,
 * }} stats
 */
export function computeBusinessRankingBreakdown(stats) {
    const hostedInvitations = Number(stats?.hostedInvitations ?? stats?.totalInvitations) || 0;
    const profileLikes = Number(stats?.profileLikes) || 0;
    const postLikes = Number(stats?.postLikes) || 0;
    const ratingStarsTotal = Number.isFinite(Number(stats?.ratingStarsTotal))
        ? Number(stats.ratingStarsTotal)
        : Math.round((Number(stats?.rating) || 0) * (Number(stats?.reviewCount) || 0));

    const hostingPoints = hostedInvitations * BUSINESS_POINT_VALUES.hosting;
    const profileLikePoints = profileLikes * BUSINESS_POINT_VALUES.profileLike;
    const postLikePoints = postLikes * BUSINESS_POINT_VALUES.postLike;
    const ratingPoints = ratingStarsTotal * BUSINESS_POINT_VALUES.ratingStar;

    return {
        hostedInvitations,
        profileLikes,
        postLikes,
        ratingStarsTotal,
        hostingPoints,
        profileLikePoints,
        postLikePoints,
        ratingPoints,
        total: hostingPoints + profileLikePoints + postLikePoints + ratingPoints,
    };
}

/** @param {Parameters<typeof computeBusinessRankingBreakdown>[0]} stats */
export function computeBusinessRankingScore(stats) {
    return computeBusinessRankingBreakdown(stats).total;
}

// Country normalization: prefer stable 2-letter codes, with safe fallbacks from common names.
function normalizeCountry(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (/^[a-z]{2}$/.test(lower)) return lower;
    if (lower.includes('australia')) return 'au';
    if (lower.includes('united states') || lower.includes('usa') || lower === 'us') return 'us';
    if (lower.includes('united kingdom') || lower === 'uk' || lower.includes('great britain')) return 'gb';
    return lower.split(/[()\s]/).filter(Boolean)[0] || '';
}

function normalizeCity(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    let lower = raw.toLowerCase();
    lower = lower.split(',')[0];
    lower = lower.replace(/\b(region|city)\b\s*$/i, '');
    lower = lower.replace(/\s+/g, ' ').trim();
    lower = lower.split(' ')[0];
    return lower;
}

/**
 * @param {{ city?: string, country?: string, state?: string, region?: string, businessPublic?: object }} business
 */
export function getScopeKey(business) {
    const bp = business?.businessPublic || business;
    const city = normalizeCity(bp?.city || bp?.address || business?.city || '');
    const country = normalizeCountry(bp?.country || business?.country || '');
    const region = (bp?.state || bp?.region || business?.state || business?.region || '').toString().trim().toLowerCase();
    return { city, region, country };
}

const DEFAULT_LIMIT = 100;

/**
 * @param {Array<{ id: string, rankingScore?: number, [key: string]: any }>} businesses
 * @param {'city' | 'region' | 'country' | 'global'} scope
 * @param {{ city?: string, region?: string, country?: string }} userScope
 * @param {number} limit
 */
export function rankBusinesses(businesses, scope, userScope = {}, limit = DEFAULT_LIMIT) {
    const list = Array.isArray(businesses) ? businesses : [];
    const withScore = list.map(b => ({
        ...b,
        _scopeKey: getScopeKey(b)
    })).filter(b => typeof b.rankingScore === 'number');

    let filtered = withScore;
    if (scope !== 'global') {
        const uCity = normalizeCity(userScope.city);
        const uRegion = (userScope.region || '').toString().trim().toLowerCase();
        const uCountry = normalizeCountry(userScope.country);
        if (scope === 'city' && uCity) {
            filtered = withScore.filter(b => b._scopeKey.city === uCity);
        } else if (scope === 'region' && uRegion) {
            filtered = withScore.filter(b => b._scopeKey.region === uRegion);
        } else if (scope === 'country' && uCountry) {
            filtered = withScore.filter(b => b._scopeKey.country === uCountry);
        }
    }

    const sorted = [...filtered].sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0));
    const top = sorted.slice(0, limit);

    const scopeLabel = scope === 'city' ? (userScope.city || 'City') : scope === 'region' ? (userScope.region || 'Region') : scope === 'country' ? (userScope.country || 'Country') : 'Global';

    return {
        ranked: top.map((b, i) => ({ rank: i + 1, business: b })),
        scope: scopeLabel,
        totalInScope: filtered.length
    };
}

/**
 * @param {Array<object>} businesses
 * @param {object} statsById
 */
export function attachRankingScores(businesses, statsById = {}) {
    return (businesses || []).map(b => {
        const id = b.id || b.uid;
        const stats = statsById[id] || {};
        const fromBiz = b.businessInfo || b.businessPublic || b;
        const combined = {
            hostedInvitations: stats.hostedInvitations ?? stats.totalInvitations ?? fromBiz.totalInvitations ?? 0,
            profileLikes: stats.profileLikes ?? fromBiz.profileLikes ?? 0,
            postLikes: stats.postLikes ?? fromBiz.postLikes ?? 0,
            ratingStarsTotal: stats.ratingStarsTotal ?? fromBiz.ratingStarsTotal ?? 0,
            totalInvitations: stats.totalInvitations ?? stats.hostedInvitations ?? fromBiz.totalInvitations ?? 0,
            rating: stats.rating ?? stats.averageRating ?? fromBiz.rating ?? 0,
            reviewCount: stats.reviewCount ?? fromBiz.reviewCount ?? 0,
        };
        const breakdown = computeBusinessRankingBreakdown(combined);
        return {
            ...b,
            rankingScore: breakdown.total,
            _rankingStats: combined,
            _rankingBreakdown: breakdown,
        };
    });
}
