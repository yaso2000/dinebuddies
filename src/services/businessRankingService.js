/**
 * Business evaluation and ranking using 6 metrics only (Active Invitations excluded).
 * Scopes: city → region (state/province) → country → global. Top 100 per scope.
 */

const DEFAULT_LIMIT = 100;

/**
 * Weights for the 6 metrics (Community Members, Total Invitations, Rating×reviews, Profile Views, Profile Likes, Profile Shares).
 * Active Invitations is explicitly excluded from evaluation.
 * Total Invitations has higher weight — the app is built around invitations.
 */
const WEIGHTS = {
    memberCount: 2,
    totalInvitations: 3,
    ratingWithReviews: 1,   // rating * min(reviewCount, 20)
    profileViews: 1,
    profileLikes: 2,
    profileShares: 2
};

/**
 * Compute a single ranking score from the 6 evaluation metrics.
 * @param {{
 *   memberCount?: number,
 *   totalInvitations?: number,
 *   rating?: number,
 *   reviewCount?: number,
 *   profileViews?: number,
 *   profileLikes?: number,
 *   profileShares?: number
 * }} stats
 * @returns {number}
 */
export function computeBusinessRankingScore(stats) {
    if (!stats) return 0;
    const members = Number(stats.memberCount) || 0;
    const totalInv = Number(stats.totalInvitations) || 0;
    const rating = Number(stats.rating) || 0;
    const reviewCount = Math.max(0, Number(stats.reviewCount) || 0);
    const views = Number(stats.profileViews) || 0;
    const likes = Number(stats.profileLikes) || 0;
    const shares = Number(stats.profileShares) || 0;

    const ratingPower = rating * Math.min(reviewCount, 20);

    return (
        WEIGHTS.memberCount * members +
        WEIGHTS.totalInvitations * totalInv +
        WEIGHTS.ratingWithReviews * ratingPower +
        WEIGHTS.profileViews * views +
        WEIGHTS.profileLikes * likes +
        WEIGHTS.profileShares * shares
    );
}

// Country normalization: prefer stable 2-letter codes, with safe fallbacks from common names.
function normalizeCountry(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    // If already looks like a 2-letter code (e.g. AU, US), use it.
    if (/^[a-z]{2}$/.test(lower)) return lower;
    // Common mappings (extendable, deterministic).
    if (lower.includes('australia')) return 'au';
    if (lower.includes('united states') || lower.includes('usa') || lower === 'us') return 'us';
    if (lower.includes('united kingdom') || lower === 'uk' || lower.includes('great britain')) return 'gb';
    // Fallback: take first word (e.g. "Australia (AU)") and lower-case it.
    return lower.split(/[()\s]/).filter(Boolean)[0] || '';
}

// City normalization: handle variants like "Bundaberg", "Bundaberg Region", "Bundaberg, QLD".
function normalizeCity(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    let lower = raw.toLowerCase();
    // Take text before first comma (drops ", qld" etc).
    lower = lower.split(',')[0];
    // Drop trailing generic suffixes like "region", "city".
    lower = lower.replace(/\b(region|city)\b\s*$/i, '');
    // Collapse multiple spaces.
    lower = lower.replace(/\s+/g, ' ').trim();
    // Keep only the first word (e.g. "bundaberg qld" -> "bundaberg").
    lower = lower.split(' ')[0];
    return lower;
}

/**
 * Get scope keys from a business for filtering. Normalizes for comparison.
 * @param {{ city?: string, country?: string, state?: string, region?: string, businessPublic?: object }} business
 * @returns {{ city: string, region: string, country: string }}
 */
export function getScopeKey(business) {
    const bp = business?.businessPublic || business;
    const city = normalizeCity(bp?.city || bp?.address || business?.city || '');
    const country = normalizeCountry(bp?.country || business?.country || '');
    const region = (bp?.state || bp?.region || business?.state || business?.region || '').toString().trim().toLowerCase();
    return { city, region, country };
}

/**
 * Rank businesses by score (best first), optionally filter by scope, return top N.
 * @param {Array<{ id: string, rankingScore?: number, [key: string]: any }>} businesses - each must have rankingScore and scope keys (city, country, region if needed)
 * @param {'city' | 'region' | 'country' | 'global'} scope
 * @param {{ city?: string, region?: string, country?: string }} userScope - current user's city/region/country for filtering
 * @param {number} limit
 * @returns {{ ranked: Array<{ rank: number, business: object }>, scope: string }}
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
 * Attach rankingScore and scope keys to a list of businesses using the 6 metrics.
 * @param {Array<object>} businesses
 * @param {object} statsById - optional map id -> { memberCount, totalInvitations, rating, reviewCount, profileViews, profileLikes, profileShares }
 * @returns {Array<object>}
 */
export function attachRankingScores(businesses, statsById = {}) {
    return (businesses || []).map(b => {
        const id = b.id || b.uid;
        const stats = statsById[id] || {};
        const fromBiz = b.businessInfo || b.businessPublic || b;
        const combined = {
            memberCount: stats.memberCount ?? fromBiz.memberCount ?? 0,
            totalInvitations: stats.totalInvitations ?? fromBiz.totalInvitations ?? 0,
            rating: stats.rating ?? stats.averageRating ?? fromBiz.rating ?? 0,
            reviewCount: stats.reviewCount ?? fromBiz.reviewCount ?? 0,
            profileViews: stats.profileViews ?? fromBiz.profileViews ?? 0,
            profileLikes: stats.profileLikes ?? fromBiz.profileLikes ?? 0,
            profileShares: stats.profileShares ?? fromBiz.profileShares ?? 0
        };
        return {
            ...b,
            rankingScore: computeBusinessRankingScore(combined),
            _rankingStats: combined
        };
    });
}
