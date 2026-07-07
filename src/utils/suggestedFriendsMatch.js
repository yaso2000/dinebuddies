import { normalizePlaceLabel } from './postsFeedScope';
import { readFavoritePlaces } from './favoritePlacesUtils';

function placeIdFromFavorite(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry.trim();
    return String(entry.id || entry.placeId || entry.businessId || '').trim();
}

function favoritePlaceIds(source) {
    return readFavoritePlaces(source)
        .map(placeIdFromFavorite)
        .filter(Boolean);
}

/**
 * Score how well a directory user matches the viewer profile.
 * Higher = better match (age category, area, shared favorite restaurants).
 */
export function scoreSuggestedFriendMatch(viewer, candidate) {
    if (!viewer?.id || !candidate?.id || viewer.id === candidate.id) return -1;

    let score = 0;

    const viewerAge = String(viewer.ageCategory || viewer.ageRange || '').trim().toLowerCase();
    const candidateAge = String(candidate.ageCategory || candidate.ageRange || '').trim().toLowerCase();
    if (viewerAge && candidateAge && viewerAge === candidateAge) {
        score += 3;
    }

    const viewerCity = normalizePlaceLabel(viewer.city);
    const candidateCity = normalizePlaceLabel(candidate.city);
    if (viewerCity && candidateCity) {
        if (viewerCity === candidateCity || candidateCity.includes(viewerCity) || viewerCity.includes(candidateCity)) {
            score += 2;
        }
    } else {
        const viewerCountry = normalizePlaceLabel(viewer.country);
        const candidateCountry = normalizePlaceLabel(candidate.country);
        if (viewerCountry && candidateCountry && viewerCountry === candidateCountry) {
            score += 1;
        }
    }

    const viewerFavs = new Set(favoritePlaceIds(viewer));
    if (viewerFavs.size > 0) {
        let overlap = 0;
        favoritePlaceIds(candidate).forEach((id) => {
            if (viewerFavs.has(id)) overlap += 1;
        });
        score += Math.min(overlap * 2, 6);
    }

    return score;
}

/** @param {object[]} users @param {object} viewer @param {number} limit */
export function pickSuggestedFriends(users, viewer, { limit = 4, excludeIds = new Set() } = {}) {
    const scored = (users || [])
        .filter((u) => u?.id && !excludeIds.has(u.id))
        .map((u) => ({ user: u, score: scoreSuggestedFriendMatch(viewer, u) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ user }) => user);
}

export function buildSuggestedFriendViewerProfile(userProfile, currentUser) {
    const uid = currentUser?.uid || currentUser?.id || userProfile?.id;
    return {
        id: uid,
        ageCategory: userProfile?.ageCategory || userProfile?.ageRange || '',
        ageRange: userProfile?.ageRange || userProfile?.ageCategory || '',
        city: userProfile?.city || '',
        country: userProfile?.country || '',
        favoritePlaces: readFavoritePlaces(userProfile),
        following: currentUser?.following || userProfile?.following || [],
    };
}
