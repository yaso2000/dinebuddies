function pickString(...values) {
    for (const value of values) {
        const s = String(value || '').trim();
        if (s) return s;
    }
    return '';
}

/** @param {string} displayName */
function extractFirstName(displayName) {
    const s = pickString(displayName);
    if (!s) return '';
    return s.split(/\s+/)[0] || s;
}

/** @param {string[]} foods */
function normalizeFoodList(foods) {
    if (!Array.isArray(foods)) return [];
    return foods
        .filter((f) => typeof f === 'string' && f.trim())
        .map((f) => f.trim())
        .slice(0, 8);
}

/**
 * @param {string} ageGroup e.g. "25-34"
 * @returns {number | null} midpoint age
 */
function ageGroupMidpoint(ageGroup) {
    const s = pickString(ageGroup);
    const m = s.match(/^(\d+)\s*-\s*(\d+)/);
    if (m) return (Number(m[1]) + Number(m[2])) / 2;
    if (s.endsWith('+')) {
        const n = Number(s.replace('+', ''));
        return Number.isFinite(n) ? n + 5 : null;
    }
    return null;
}

/**
 * @param {string} hostAgeGroup
 * @param {string} inviteeAgeGroup
 */
function describeAgeGap(hostAgeGroup, inviteeAgeGroup) {
    const hostMid = ageGroupMidpoint(hostAgeGroup);
    const inviteeMid = ageGroupMidpoint(inviteeAgeGroup);
    if (hostMid == null || inviteeMid == null) return '';
    const diff = Math.round(Math.abs(hostMid - inviteeMid));
    if (diff <= 2) return 'similar age';
    return `${diff} years apart`;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function intersectLists(a, b) {
    const setB = new Set(b.map((x) => x.toLowerCase()));
    return a.filter((x) => setB.has(x.toLowerCase()));
}

/**
 * @param {Record<string, unknown>} data
 */
function personalityVibeFromProfile(data) {
    const bio = pickString(data.bio, data.about, data.description);
    if (bio) return bio.slice(0, 160);
    const foods = normalizeFoodList(data.favoriteFoods);
    if (foods.length) return `Foodie — ${foods.slice(0, 3).join(', ')}`;
    return '';
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeIdList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim());
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} partnerId
 */
async function fetchCommunityBusinessCard(db, partnerId) {
    try {
        const userSnap = await db.collection('users').doc(partnerId).get();
        if (userSnap.exists) {
            const data = userSnap.data() || {};
            const bi =
                data.businessInfo && typeof data.businessInfo === 'object' && !Array.isArray(data.businessInfo)
                    ? data.businessInfo
                    : {};
            const businessName = pickString(bi.businessName, data.display_name, data.displayName, data.name);
            const businessType = pickString(bi.businessType, data.business_type, 'Restaurant');
            if (businessName) {
                return { id: partnerId, name: businessName, type: businessType };
            }
        }
    } catch (e) {
        console.warn('[datingAiPersonalization] users fetch failed', partnerId, e);
    }

    try {
        const pubSnap = await db.collection('public_profiles').doc(partnerId).get();
        if (pubSnap.exists) {
            const p = pubSnap.data() || {};
            if (p.profileType === 'business') {
                const bp = p.businessPublic || {};
                const businessName = pickString(bp.businessName, p.displayName, p.name);
                const businessType = pickString(bp.businessType, p.business_type, 'Restaurant');
                if (businessName) {
                    return { id: partnerId, name: businessName, type: businessType };
                }
            }
        }
    } catch (e) {
        console.warn('[datingAiPersonalization] public_profiles fetch failed', partnerId, e);
    }

    return null;
}

/**
 * Shared food/restaurant communities between host and invitee.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string[]} hostCommunities
 * @param {string[]} inviteeCommunities
 */
async function resolveSharedCommunities(db, hostCommunities, inviteeCommunities) {
    const hostSet = new Set(hostCommunities);
    const sharedIds = inviteeCommunities.filter((id) => hostSet.has(id)).slice(0, 6);

    /** @type {{ id: string, name: string, type: string }[]} */
    const shared = [];
    for (const id of sharedIds) {
        const card = await fetchCommunityBusinessCard(db, id);
        if (card) shared.push(card);
    }
    return shared;
}

/**
 * Build Gemini personalization context for private invite text.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} hostUid
 * @param {Record<string, unknown>} hostUserData
 * @param {{
 *   inviteeId: string,
 *   date: string,
 *   time: string,
 *   venueDetails?: Record<string, unknown>,
 * }} input
 */
export async function resolvePrivateInvitationPersonalization(db, hostUid, hostUserData, input) {
    const inviteeId = pickString(input.inviteeId);
    const date = pickString(input.date);
    const time = pickString(input.time);
    const venue = input.venueDetails && typeof input.venueDetails === 'object' ? input.venueDetails : {};

    /** @type {Record<string, unknown>} */
    const context = {
        inviteeId,
        date,
        time,
        venueDetails: {
            venueId: pickString(venue.venueId, venue.restaurantId) || undefined,
            name: pickString(venue.name, venue.venueName),
            address: pickString(venue.address, venue.location),
            city: pickString(venue.city),
            country: pickString(venue.country),
            lat: typeof venue.lat === 'number' ? venue.lat : undefined,
            lng: typeof venue.lng === 'number' ? venue.lng : undefined,
        },
    };

    if (!inviteeId) return context;

    const hostGender = pickString(hostUserData?.gender, hostUserData?.sex, hostUserData?.profileGender);
    const hostAgeGroup = pickString(
        hostUserData?.ageCategory,
        hostUserData?.ageGroup,
        hostUserData?.age_group,
        hostUserData?.ageRange,
    );
    const hostFirstName = extractFirstName(
        pickString(hostUserData?.display_name, hostUserData?.displayName, hostUserData?.name),
    );
    const hostFavoriteFoods = normalizeFoodList(hostUserData?.favoriteFoods);
    const hostPersonalityVibe = personalityVibeFromProfile(hostUserData || {});

    let inviteeName = '';
    let inviteeCommunities = [];
    let inviteeGender = '';
    let inviteeAgeGroup = '';
    /** @type {string[]} */
    let inviteeFavoriteFoods = [];
    let inviteePersonalityVibe = '';

    try {
        const inviteeSnap = await db.collection('users').doc(inviteeId).get();
        if (inviteeSnap.exists) {
            const data = inviteeSnap.data() || {};
            inviteeName = pickString(data.display_name, data.displayName, data.name);
            inviteeCommunities = normalizeIdList(data.joinedCommunities);
            inviteeGender = pickString(data.gender, data.sex, data.profileGender);
            inviteeAgeGroup = pickString(
                data.ageCategory,
                data.ageGroup,
                data.age_group,
                data.ageRange,
            );
            inviteeFavoriteFoods = normalizeFoodList(data.favoriteFoods);
            inviteePersonalityVibe = personalityVibeFromProfile(data);
        }
    } catch (e) {
        console.warn('[datingAiPersonalization] invitee profile fetch failed', e);
    }

    /** @type {string[]} */
    const inviteeCommunityNames = [];
    for (const communityId of inviteeCommunities.slice(0, 6)) {
        const card = await fetchCommunityBusinessCard(db, communityId);
        if (card?.name) inviteeCommunityNames.push(card.name);
    }

    const hostCommunities = normalizeIdList(hostUserData?.joinedCommunities);
    const sharedCommunities = await resolveSharedCommunities(db, hostCommunities, inviteeCommunities);
    const sharedFoodPreferences = intersectLists(hostFavoriteFoods, inviteeFavoriteFoods);
    const sharedInterests = [
        ...sharedCommunities.map((c) => c.name),
        ...sharedFoodPreferences,
    ].filter(Boolean);

    context.senderFirstName = hostFirstName || undefined;
    context.senderGender = hostGender || undefined;
    context.senderAgeGroup = hostAgeGroup || undefined;
    context.senderPersonalityVibe = hostPersonalityVibe || undefined;
    context.senderFavoriteFoods = hostFavoriteFoods.length ? hostFavoriteFoods : undefined;
    context.inviteeName = extractFirstName(inviteeName) || inviteeName || undefined;
    context.inviteeGender = inviteeGender || undefined;
    context.inviteeAgeGroup = inviteeAgeGroup || undefined;
    context.inviteePersonalityVibe = inviteePersonalityVibe || undefined;
    context.inviteeFavoriteFoods = inviteeFavoriteFoods.length ? inviteeFavoriteFoods : undefined;
    context.inviteeCommunityNames = inviteeCommunityNames.length ? inviteeCommunityNames : undefined;
    context.sharedCommunities = sharedCommunities;
    context.sharedFoodPreferences = sharedFoodPreferences.length ? sharedFoodPreferences : undefined;
    context.sharedInterests = sharedInterests.length ? sharedInterests : undefined;
    context.ageGap = describeAgeGap(hostAgeGroup, inviteeAgeGroup) || undefined;
    context.hostCommunityCount = hostCommunities.length;
    context.inviteeCommunityCount = inviteeCommunities.length;

    return context;
}
